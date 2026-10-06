"""Local-only AI access to statistics and blog content."""

from __future__ import annotations

import ipaddress
import os
import re
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException, Request
from sqlalchemy import func, or_, update
from sqlmodel import Session, select

from app.models import Post


REVISION_DB_PATH = Path(__file__).resolve().parents[2] / ".private" / "draft-revisions.sqlite3"
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_WORKER_REQUIRED_KEYS = {"timezone", "dateBoundary", "source", "queriedAt", "range", "totals", "daily", "ranking"}


def parse_iso_date(value: str) -> date:
    if not _DATE_RE.fullmatch(value):
        raise HTTPException(status_code=422, detail="日期必须使用 YYYY-MM-DD 格式")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="日期无效") from exc
    if parsed.isoformat() != value:
        raise HTTPException(status_code=422, detail="日期无效")
    return parsed


def _is_loopback_client(request: Request) -> bool:
    client = request.client
    if client is None:
        return False
    try:
        return ipaddress.ip_address(client.host.split("%", 1)[0]).is_loopback
    except ValueError:
        return False


def _has_localhost_host(request: Request) -> bool:
    value = request.headers.get("host", "").strip().lower()
    if value == "localhost":
        return True
    match = re.fullmatch(r"localhost:(\d{1,5})", value)
    return bool(match and 1 <= int(match.group(1)) <= 65535)


def _configured_token(name: str) -> str:
    read_token = os.getenv("BLOG_AI_READ_TOKEN", "")
    draft_token = os.getenv("BLOG_AI_DRAFT_TOKEN", "")
    if len(read_token) < 32 or len(draft_token) < 32 or read_token == draft_token:
        raise HTTPException(status_code=503, detail="本机 AI 接口尚未配置")
    return read_token if name == "BLOG_AI_READ_TOKEN" else draft_token


def authorize_local_request(request: Request, authorization: str | None, token_name: str) -> None:
    if not _is_loopback_client(request) or not _has_localhost_host(request):
        raise HTTPException(status_code=403, detail="仅允许本机访问")
    expected = _configured_token(token_name)
    scheme, separator, supplied = (authorization or "").partition(" ")
    if not separator or scheme.lower() != "bearer" or not supplied or supplied != supplied.strip():
        raise HTTPException(status_code=401, detail="无效的本机访问令牌", headers={"WWW-Authenticate": "Bearer"})
    import hmac

    if not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="无效的本机访问令牌", headers={"WWW-Authenticate": "Bearer"})


def _worker_url() -> str:
    base = os.getenv("BLOG_STATS_URL", "").strip().rstrip("/")
    token = os.getenv("BLOG_STATS_ADMIN_TOKEN", "")
    if not base or len(token) < 32:
        raise HTTPException(status_code=503, detail="统计服务暂不可用")
    try:
        parsed = urlsplit(base)
        hostname = parsed.hostname or ""
        port = parsed.port
        try:
            local = hostname.lower() == "localhost" or ipaddress.ip_address(hostname).is_loopback
        except ValueError:
            local = False
    except ValueError:
        local = False
        parsed = None
    if (
        parsed is None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
        or port is not None and not 1 <= port <= 65535
        or not (parsed.scheme == "https" or parsed.scheme == "http" and local)
    ):
        raise HTTPException(status_code=503, detail="统计服务暂不可用")
    return base


def get_statistics(start: date, end: date) -> dict[str, Any]:
    if start > end:
        raise HTTPException(status_code=422, detail="开始日期不能晚于结束日期")
    base = _worker_url()
    token = os.getenv("BLOG_STATS_ADMIN_TOKEN", "")
    try:
        # Cloud traffic may require the owner's configured HTTPS proxy on Windows.
        # Local HTTP test/bridge endpoints remain direct.
        with httpx.Client(timeout=10.0, trust_env=urlsplit(base).scheme == "https", follow_redirects=False) as client:
            response = client.get(
                f"{base}/admin/summary",
                params={"start": start.isoformat(), "end": end.isoformat()},
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code != 200:
            raise ValueError("upstream status")
        payload = response.json()
        if not isinstance(payload, dict) or not _WORKER_REQUIRED_KEYS.issubset(payload):
            raise ValueError("upstream schema")
        if payload["timezone"] != "Asia/Shanghai" or payload["dateBoundary"] != "event date in Asia/Shanghai, inclusive start and end":
            raise ValueError("upstream date contract")
        if payload["range"] != {"start": start.isoformat(), "end": end.isoformat()}:
            raise ValueError("upstream range")
        if not isinstance(payload["source"], str) or not payload["source"] or not isinstance(payload["queriedAt"], str):
            raise ValueError("upstream metadata")
        datetime.fromisoformat(payload["queriedAt"].replace("Z", "+00:00"))
        if not isinstance(payload["totals"], dict) or not {"pv", "sessions", "uv"}.issubset(payload["totals"]):
            raise ValueError("upstream totals")
        if not isinstance(payload["daily"], list) or not isinstance(payload["ranking"], list):
            raise ValueError("upstream rows")
        return payload
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        raise HTTPException(status_code=503, detail="统计服务暂不可用") from None


def _post_summary(post: Post) -> dict[str, Any]:
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "description": post.description,
        "status": post.status,
        "views": post.views,
        "likes": post.likes,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    }


def search_drafts(session: Session, search: str = "", page: int = 1, size: int = 20) -> dict[str, Any]:
    query = select(Post).where(Post.status == "draft")
    needle = search.strip()
    if needle:
        query = query.where(or_(
            Post.title.contains(needle),
            Post.description.contains(needle),
            Post.content.contains(needle),
        ))
    count_query = select(func.count()).select_from(Post).where(Post.status == "draft")
    if needle:
        count_query = count_query.where(or_(
            Post.title.contains(needle), Post.description.contains(needle), Post.content.contains(needle),
        ))
    total = session.exec(count_query).one()
    posts = session.exec(query.order_by(Post.updated_at.desc(), Post.id.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [_post_summary(post) for post in posts], "page": page, "size": size, "total": total}


def read_post(session: Session, post_id: int) -> dict[str, Any]:
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "description": post.description,
        "content": post.content,
        "status": post.status,
        "views": post.views,
        "likes": post.likes,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    }


def _normalize_expected(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone().replace(tzinfo=None)
    return value


def _save_revision(post: Post) -> int:
    path = Path(REVISION_DB_PATH)
    connection = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=3.0)
        with connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS draft_revisions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    content TEXT NOT NULL,
                    previous_updated_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            cursor = connection.execute(
                "INSERT INTO draft_revisions (post_id, title, description, content, previous_updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (post.id, post.title, post.description or "", post.content or "", post.updated_at.isoformat(), datetime.now().isoformat()),
            )
            return int(cursor.lastrowid)
    except (OSError, sqlite3.Error):
        raise HTTPException(status_code=503, detail="无法保存草稿版本，原稿未修改") from None
    finally:
        if connection is not None:
            connection.close()


def get_revision(post_id: int, revision_id: int) -> dict[str, Any]:
    if not Path(REVISION_DB_PATH).is_file():
        raise HTTPException(status_code=404, detail="草稿版本不存在")
    connection = None
    try:
        connection = sqlite3.connect(REVISION_DB_PATH, timeout=3.0)
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            "SELECT id, post_id, title, description, content, previous_updated_at FROM draft_revisions WHERE id = ? AND post_id = ?",
            (revision_id, post_id),
        ).fetchone()
    except (OSError, sqlite3.Error):
        raise HTTPException(status_code=503, detail="草稿版本不可用") from None
    finally:
        if connection is not None:
            connection.close()
    if row is None:
        raise HTTPException(status_code=404, detail="草稿版本不存在")
    return dict(row)


def update_draft(
    session: Session,
    post_id: int,
    expected_updated_at: datetime,
    changes: dict[str, str],
) -> dict[str, Any]:
    allowed = {"title", "description", "content"}
    if not changes or not set(changes).issubset(allowed):
        raise HTTPException(status_code=422, detail="只允许修改标题、摘要和正文")
    expected = _normalize_expected(expected_updated_at)
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    if post.status != "draft":
        raise HTTPException(status_code=409, detail="只允许修改草稿")
    if post.updated_at != expected:
        raise HTTPException(status_code=409, detail="草稿已被其他操作修改，请重新读取后再提交")

    if "content" in changes:
        word_count = len(changes["content"])
        changes = {**changes, "word_count": word_count, "reading_time": max(1, word_count // 300)}
    revision_id = _save_revision(post)
    updated_at = max(datetime.now(), expected + timedelta(microseconds=1))
    statement = (
        update(Post)
        .where(Post.id == post_id, Post.status == "draft", Post.updated_at == expected)
        .values(**changes, updated_at=updated_at)
    )
    try:
        result = session.execute(statement)
        if result.rowcount != 1:
            session.rollback()
            raise HTTPException(status_code=409, detail="草稿已被其他操作修改，请重新读取后再提交")
        session.commit()
    except HTTPException:
        raise
    except Exception:
        session.rollback()
        raise HTTPException(status_code=503, detail="草稿保存失败") from None
    session.expire_all()
    updated = session.get(Post, post_id)
    if not updated:
        raise HTTPException(status_code=503, detail="草稿保存后无法读取")
    return {**read_post(session, post_id), "revision_id": revision_id}


def restore_draft_revision(
    session: Session,
    post_id: int,
    revision_id: int,
    expected_updated_at: datetime,
) -> dict[str, Any]:
    previous = get_revision(post_id, revision_id)
    restored = update_draft(
        session,
        post_id,
        expected_updated_at,
        {key: previous[key] for key in ("title", "description", "content")},
    )
    restored["restored_revision_id"] = revision_id
    return restored
