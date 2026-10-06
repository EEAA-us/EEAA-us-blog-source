#!/usr/bin/env python3
"""Export the public site snapshot without mutating the source database."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlparse
from PIL import Image

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
from app.schemas.hero_media_catalog import HeroMediaCatalog
from app.schemas.blog_appearance import BlogAppearanceDefaults

PUBLIC_CONFIG_KEYS = {
    "title", "url", "authorName", "bio", "heroSubtitles", "avatarUrl",
    "avatarVideo", "avatarSource", "heroImage", "heroImages",
    "heroImageLibrary", "useGradient", "themeColors",
    "bgImages", "defaultPostCover", "photoWallImage", "buildDate",
    "footerBadges", "icpConfig", "moeIcpConfig", "chatterTitle",
    "chatterDescription", "social", "cloud_music_playlist_id", "cloud_music_ids",
    "heroMediaCatalog",
    "projectCovers",
    "blogAppearanceDefaults",
}


def configured_database() -> str:
    env_path = BACKEND / ".env"
    env: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"\s*DATABASE_URL\s*=\s*(.*?)\s*$", line)
            if match:
                env["DATABASE_URL"] = match.group(1).strip('"\'')
    return env.get("DATABASE_URL", os.environ.get("DATABASE_URL", "sqlite:///./kirameku.db"))


def database_path(url: str) -> Path:
    if not url.startswith("sqlite:"):
        raise ValueError(f"Only SQLite databases can be exported (got {url.split(':', 1)[0]!r})")
    if url.startswith("sqlite:///"):
        raw = url[len("sqlite:///"):]
    else:
        raw = url.removeprefix("sqlite:")
    # sqlite:////absolute/unix/path leaves one leading slash after removing
    # the SQLAlchemy triple-slash prefix; sqlite:///D:/absolute/windows/path
    # leaves a drive-qualified path.
    if re.match(r"^[A-Za-z]:/", raw):
        path = Path(raw)
    else:
        path = Path(raw)
    return path if path.is_absolute() else (BACKEND / path).resolve()


def rows(db: sqlite3.Connection, table: str, order: str = "id") -> list[dict]:
    try:
        cursor = db.execute(f'SELECT * FROM "{table}" ORDER BY "{order}"')
        names = [column[0] for column in cursor.description]
        return [dict(zip(names, row)) for row in cursor.fetchall()]
    except sqlite3.OperationalError as exc:
        if "no such table" in str(exc):
            return []
        raise


def iso(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()


def parse_json(value, fallback):
    try:
        return json.loads(value) if value else fallback
    except (TypeError, json.JSONDecodeError):
        return fallback


def public_path(reference: str) -> str | None:
    if not reference or reference.startswith(("http://", "https://", "data:", "#")):
        return None
    parsed = urlparse(reference)
    path = unquote(parsed.path).replace("\\", "/")
    if path.startswith("/uploads/"):
        return path
    # Other root-relative references are supplied by the runner's public/ copy.
    return None


def embedded_local_references(content: str) -> set[str]:
    # Markdown images and HTML image/source attributes used in article bodies.
    matches = re.findall(r"!\[[^\]]*\]\(\s*<?([^\s)>]+)|\b(?:src|poster)\s*=\s*['\"]([^'\"]+)", content, re.IGNORECASE)
    return {first or second for first, second in matches if (first or second).startswith("/")}


def config_local_references(value) -> set[str]:
    if isinstance(value, str):
        parsed = urlparse(value)
        return {value} if not parsed.scheme and not parsed.netloc and parsed.path.startswith("/") else set()
    if isinstance(value, list):
        return set().union(*(config_local_references(item) for item in value)) if value else set()
    if isinstance(value, dict):
        return set().union(*(config_local_references(item) for item in value.values())) if value else set()
    return set()


def copy_uploads(references: set[str], output: Path) -> None:
    upload_root = (BACKEND / "uploads").resolve()
    for reference in references:
        relative = PurePosixPath(unquote(urlparse(reference).path).removeprefix("/uploads/"))
        source = (upload_root / Path(*relative.parts)).resolve()
        if upload_root not in source.parents or not source.is_file():
            raise FileNotFoundError(f"Referenced upload does not exist: {reference}")
        destination = output / "public" / "uploads" / Path(*relative.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def article_image_dimensions(content: str, output: Path) -> dict:
    """Read only referenced local headers; never fetch remote images or change files."""
    public_root = (output / "public").resolve()
    dimensions = {}
    for ref in embedded_local_references(content):
        parsed = urlparse(ref)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
            continue
        image_path = (public_root / unquote(parsed.path).lstrip("/")).resolve()
        if public_root not in image_path.parents or not image_path.is_file():
            continue
        try:
            if image_path.suffix.lower() == ".svg":
                with image_path.open(encoding="utf-8") as svg_file:
                    header = svg_file.read(8192)
                svg = re.search(r"<svg\b[^>]*>", header)
                view_box = re.search(r'''viewBox\s*=\s*["']([^"']+)["']''', svg.group(0)) if svg else None
                if not view_box:
                    continue
                _, _, width, height = map(float, re.split(r"[\s,]+", view_box.group(1).strip()))
                if not math.isfinite(width) or not math.isfinite(height):
                    continue
                width, height = math.ceil(width), math.ceil(height)
            else:
                with Image.open(image_path) as image:
                    width, height = image.size
                    if image.getexif().get(274) in (6, 8):
                        width, height = height, width
            if width > 0 and height > 0:
                dimensions[ref] = {"width": width, "height": height}
        except (OSError, ValueError, Image.DecompressionBombError):
            # Unrecognized images remain native images without guessed dimensions.
            continue
    return dimensions


def export(output: Path) -> None:
    source_path = database_path(configured_database())
    if not source_path.is_file():
        raise FileNotFoundError(f"Configured SQLite database not found: {source_path}")
    source = sqlite3.connect(f"{source_path.as_uri()}?mode=ro", uri=True)
    snapshot = sqlite3.connect(":memory:")
    try:
        source.backup(snapshot)
    finally:
        source.close()

    posts_table = rows(snapshot, "post")
    categories_table = rows(snapshot, "category")
    tags_table = rows(snapshot, "tag")
    post_tags = rows(snapshot, "post_tag", "post_id")
    categories_by_id = {item["id"]: item for item in categories_table}
    tags_by_id = {item["id"]: item for item in tags_table}
    tags_by_post: dict[int, list[str]] = {}
    tag_slugs_by_post: dict[int, list[str]] = {}
    for relation in post_tags:
        tag = tags_by_id.get(relation["tag_id"])
        if tag:
            tags_by_post.setdefault(relation["post_id"], []).append(tag["name"])
            tag_slugs_by_post.setdefault(relation["post_id"], []).append(tag["slug"])

    exported_posts = []
    details = []
    refs: set[str] = set()
    for post in posts_table:
        if post.get("status") != "published":
            continue
        category = categories_by_id.get(post.get("category_id"))
        tags = tags_by_post.get(post["id"], [])
        item = {
            "id": post["id"], "title": post["title"], "slug": post["slug"],
            "description": post["description"] or "", "cover": post["cover"] or "",
            "category": category["name"] if category else "", "tags": tags,
            "tagSlugs": tag_slugs_by_post.get(post["id"], []),
            "status": "published", "is_pinned": bool(post["is_pinned"]),
            "views": int(post["views"] or 0), "likes": int(post["likes"] or 0),
            "word_count": int(post["word_count"] or 0),
            "reading_time": int(post["reading_time"] or 0),
            "published_at": iso(post["published_at"]),
            "created_at": iso(post["created_at"]), "updated_at": iso(post["updated_at"]),
        }
        # Search text includes body terms while the body itself stays in the detail file.
        item["searchText"] = " ".join([
            item["title"], item["description"], post["content"] or "", item["category"], *tags,
        ]).casefold()
        exported_posts.append(item)
        details.append({key: value for key, value in item.items() if key not in {"searchText", "tagSlugs"}} | {"content": post["content"] or ""})
        if item["cover"]:
            refs.add(item["cover"])
        refs.update(embedded_local_references(post["content"] or ""))

    # Stable sort matching backend: pinned first, created_at descending.
    exported_posts.sort(key=lambda p: (p["is_pinned"], p["created_at"] or ""), reverse=True)
    detail_path_by_id = {item["id"]: item for item in details}
    categories = [{
        "id": row["id"], "name": row["name"], "slug": row["slug"],
        "description": row["description"] or "", "sort": row["sort"],
        "post_count": sum(1 for p in exported_posts if p["category"] == row["name"]),
    } for row in sorted(categories_table, key=lambda row: row["sort"]) if any(p.get("category") == row["name"] for p in exported_posts)]

    albums = rows(snapshot, "album", "sort")
    photos_by_album: dict[int, list[dict]] = {}
    for photo in rows(snapshot, "photo", "sort"):
        entry = {key: photo[key] for key in ("id", "album_id", "url", "caption", "orientation", "sort")}
        entry["created_at"] = iso(photo["created_at"])
        photos_by_album.setdefault(photo["album_id"], []).append(entry)
        refs.add(photo["url"])
    albums_export = [{
        "id": row["id"], "title": row["title"], "description": row["description"] or "",
        "cover": row["cover"] or "", "photo_count": len(photos_by_album.get(row["id"], [])),
        "sort": row["sort"], "created_at": iso(row["created_at"]), "updated_at": iso(row["updated_at"]),
    } for row in albums]
    refs.update(a["cover"] for a in albums_export if a["cover"])

    bookmark_categories = rows(snapshot, "bookmark_category", "sort")
    sites = rows(snapshot, "bookmark_site", "sort")
    bookmarks = [{
        "id": cat["id"], "name": cat["name"], "icon": cat["icon"] or "",
        "description": cat["description"] or "", "sort": cat["sort"],
        "created_at": iso(cat["created_at"]),
        "sites": [{
            "id": site["id"], "category_id": site["category_id"], "name": site["name"],
            "url": site["url"], "icon": site["icon"] or "", "description": site["description"] or "",
            "platforms": parse_json(site["platforms"], []), "sort": site["sort"], "created_at": iso(site["created_at"]),
        } for site in sites if site["category_id"] == cat["id"]],
    } for cat in bookmark_categories]
    refs.update(site["icon"] for site in sites if site.get("icon"))

    chatters = [{
        "id": row["id"], "content": row["content"], "images": parse_json(row["images"], []),
        "mood": row["mood"] or "", "likes": row["likes"], "comments_count": row["comments_count"],
        "status": "published", "created_at": iso(row["created_at"]), "updated_at": iso(row["updated_at"]),
    } for row in rows(snapshot, "chatter") if row.get("status") == "published"]
    for chatter in chatters:
        refs.update(chatter["images"])

    all_messages = rows(snapshot, "message")
    approved = {row["id"]: row for row in all_messages if row["status"] == "approved"}
    def message_tree(parent_id=None):
        direct = [m for m in approved.values() if m["parent_id"] == parent_id]
        direct.sort(key=lambda m: m["created_at"] or "", reverse=parent_id is None)
        return [{"id": m["id"], "parent_id": m["parent_id"], "content": m["content"],
                 "status": "approved", "likes": m["likes"], "created_at": iso(m["created_at"]),
                 "replies": message_tree(m["id"])} for m in direct]
    messages = message_tree()

    projects = []
    for row in rows(snapshot, "project", "sort"):
        projects.append({
            "id": row["id"], "name": row["name"], "slug": row["slug"],
            "description": row["description"] or "", "long_description": row["long_description"] or "",
            "cover_image": row["cover_image"] or "", "tech_stack": parse_json(row["tech_stack"], []),
            "link_github": row["link_github"] or "", "link_gitee": row["link_gitee"] or "",
            "link_live": row["link_live"] or "", "link_docs": row["link_docs"] or "",
            "status": row["status"], "status_label": row["status_label"] or "",
            "is_featured": bool(row["is_featured"]), "sort": row["sort"], "created_at": iso(row["created_at"]),
        })
        if row["cover_image"]:
            refs.add(row["cover_image"])

    site_config = {}
    for row in rows(snapshot, "site_config"):
        if row["key"] not in PUBLIC_CONFIG_KEYS:
            continue
        value = (row["value"] or "") if row["key"] in {"cloud_music_playlist_id", "cloud_music_ids"} else parse_json(row["value"], row["value"] or "")
        if row["key"] == "heroMediaCatalog":
            try:
                value = HeroMediaCatalog.model_validate(value).model_dump(by_alias=True, exclude_none=True)
            except Exception as exc:
                raise ValueError(f"Invalid heroMediaCatalog configuration: {exc}") from exc
        if row["key"] == "projectCovers":
            from app.schemas.project_covers import ProjectCovers
            try:
                value = ProjectCovers.model_validate(value).model_dump()
            except Exception as exc:
                raise ValueError(f"Invalid projectCovers configuration: {exc}") from exc
        if row["key"] == "blogAppearanceDefaults":
            try:
                value = BlogAppearanceDefaults.model_validate(value).model_dump(exclude_none=True)
            except Exception as exc:
                raise ValueError(f"Invalid blogAppearanceDefaults configuration: {exc}") from exc
        site_config[row["key"]] = value
    refs.update(config_local_references(site_config))

    copy_uploads({ref for ref in refs if isinstance(ref, str) and ref.startswith("/uploads/")}, output)
    for ref in refs:
        if not isinstance(ref, str):
            continue
        parsed = urlparse(ref)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/") or parsed.path.startswith("/uploads/"):
            continue
        asset = (ROOT / "public" / unquote(urlparse(ref).path).lstrip("/")).resolve()
        public_root = (ROOT / "public").resolve()
        if public_root not in asset.parents or not asset.is_file():
            raise FileNotFoundError(f"Referenced local public asset does not exist: {ref}")

    content_dir = output / "public" / "content"
    posts_dir = content_dir / "posts"
    posts_dir.mkdir(parents=True, exist_ok=True)
    for old_file in posts_dir.glob("*.json"):
        old_file.unlink()
    for post_id, detail in detail_path_by_id.items():
        dimensions = article_image_dimensions(detail["content"], output)
        if dimensions:
            detail["image_dimensions"] = dimensions
        (posts_dir / f"{post_id}.json").write_text(json.dumps(detail, ensure_ascii=False), encoding="utf-8")
    payload = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "posts": exported_posts, "categories": categories, "albums": albums_export,
        "photos": {str(key): value for key, value in photos_by_album.items()},
        "bookmarks": bookmarks, "chatters": chatters, "messages": messages,
        "projects": projects, "siteConfig": site_config,
    }
    content_dir.mkdir(parents=True, exist_ok=True)
    (content_dir / "index.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    manifest_dir = output / "data"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "published-manifest.json").write_text(
        json.dumps([{"id": p["id"], "slug": p["slug"]} for p in exported_posts], ensure_ascii=False),
        encoding="utf-8",
    )
    snapshot.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "out")
    args = parser.parse_args()
    try:
        export(args.output.resolve())
    except (OSError, ValueError, sqlite3.Error) as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
