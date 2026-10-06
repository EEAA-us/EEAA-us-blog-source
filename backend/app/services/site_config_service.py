import json
from datetime import datetime
from sqlmodel import Session, select
from fastapi import HTTPException

from app.models import SiteConfig
from app.schemas import SiteConfigUpdate
from app.services.hero_media_catalog_service import KEY as HERO_MEDIA_KEY, normalize_catalog
from app.schemas.project_covers import ProjectCovers
from app.schemas.blog_appearance import BlogAppearanceDefaults
from pydantic import ValidationError

PROJECT_COVERS_KEY = "projectCovers"
BLOG_APPEARANCE_KEY = "blogAppearanceDefaults"
DEFAULT_BLOG_APPEARANCE = {"preferences": {}, "theme": "system"}


def normalize_blog_appearance(value) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="blogAppearanceDefaults must contain valid JSON") from exc
    try:
        return BlogAppearanceDefaults.model_validate(value).model_dump(exclude_none=True)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_context=False)) from exc


def get_blog_appearance(session: Session) -> dict:
    row = session.exec(select(SiteConfig).where(SiteConfig.key == BLOG_APPEARANCE_KEY)).first()
    return normalize_blog_appearance(row.value) if row else DEFAULT_BLOG_APPEARANCE.copy()


def save_blog_appearance(session: Session, value) -> dict:
    config = normalize_blog_appearance(value)
    encoded = json.dumps(config, ensure_ascii=False, separators=(",", ":"))
    row = session.exec(select(SiteConfig).where(SiteConfig.key == BLOG_APPEARANCE_KEY)).first()
    if row is None:
        row = SiteConfig(key=BLOG_APPEARANCE_KEY, value=encoded, description="博客默认外观")
    else:
        row.value = encoded
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    return config


def normalize_project_covers(value) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="projectCovers must contain valid JSON") from exc
    if isinstance(value, dict) and "covers" not in value:
        value = {"covers": value}
    try:
        return ProjectCovers.model_validate(value).model_dump()
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid project cover configuration") from exc


def get_project_covers(session: Session) -> dict:
    row = session.exec(select(SiteConfig).where(SiteConfig.key == PROJECT_COVERS_KEY)).first()
    if row is None:
        return {"covers": {}}
    return normalize_project_covers(row.value)


def save_project_covers(session: Session, value) -> dict:
    config = normalize_project_covers(value)
    encoded = json.dumps(config, ensure_ascii=False, separators=(",", ":"))
    row = session.exec(select(SiteConfig).where(SiteConfig.key == PROJECT_COVERS_KEY)).first()
    if row is None:
        row = SiteConfig(key=PROJECT_COVERS_KEY, value=encoded, description="项目封面映射")
    else:
        row.value = encoded
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    return config


def get_all_config(session: Session) -> dict[str, any]:
    """返回所有配置的 key-value 字典。"""
    rows = list(session.exec(select(SiteConfig)).all())
    result = {}
    for r in rows:
        try:
            result[r.key] = json.loads(r.value)
        except (json.JSONDecodeError, TypeError):
            result[r.key] = r.value
    return result


def get_all_config_list(session: Session) -> list[dict]:
    """返回所有配置的完整列表（含 id、description、updated_at）。"""
    rows = list(session.exec(select(SiteConfig).order_by(SiteConfig.id)).all())
    return [
        {
            "id": r.id,
            "key": r.key,
            "value": r.value,
            "description": r.description or "",
            "updated_at": r.updated_at.isoformat() if r.updated_at else "",
        }
        for r in rows
    ]


def create_config(session: Session, key: str, value: str, description: str = "") -> SiteConfig:
    """新建配置项。"""
    if key == HERO_MEDIA_KEY:
        value = json.dumps(normalize_catalog(value), ensure_ascii=False, separators=(",", ":"))
    elif key == PROJECT_COVERS_KEY:
        value = json.dumps(normalize_project_covers(value), ensure_ascii=False, separators=(",", ":"))
    elif key == BLOG_APPEARANCE_KEY:
        value = json.dumps(normalize_blog_appearance(value), ensure_ascii=False, separators=(",", ":"))
    existing = session.exec(select(SiteConfig).where(SiteConfig.key == key)).first()
    if existing:
        raise HTTPException(400, f"配置 {key} 已存在")
    row = SiteConfig(key=key, value=value, description=description)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def delete_config(session: Session, key: str):
    """删除配置项。"""
    row = session.exec(select(SiteConfig).where(SiteConfig.key == key)).first()
    if not row:
        raise HTTPException(404, f"配置 {key} 不存在")
    session.delete(row)
    session.commit()


def get_config(session: Session, key: str) -> any:
    row = session.exec(select(SiteConfig).where(SiteConfig.key == key)).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"配置 {key} 不存在")
    try:
        return json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        return row.value


def update_config(session: Session, key: str, data: SiteConfigUpdate) -> SiteConfig:
    if key == HERO_MEDIA_KEY:
        data.value = json.dumps(normalize_catalog(data.value), ensure_ascii=False, separators=(",", ":"))
    elif key == PROJECT_COVERS_KEY:
        data.value = json.dumps(normalize_project_covers(data.value), ensure_ascii=False, separators=(",", ":"))
    elif key == BLOG_APPEARANCE_KEY:
        data.value = json.dumps(normalize_blog_appearance(data.value), ensure_ascii=False, separators=(",", ":"))
    row = session.exec(select(SiteConfig).where(SiteConfig.key == key)).first()
    if not row:
        row = SiteConfig(key=key, value=data.value, description=data.description)
    else:
        row.value = data.value
        if data.description:
            row.description = data.description
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def batch_update_config(session: Session, configs: dict[str, str]) -> dict:
    """批量更新配置。"""
    for key, value in configs.items():
        if key == HERO_MEDIA_KEY:
            value = normalize_catalog(value)
        elif key == PROJECT_COVERS_KEY:
            value = normalize_project_covers(value)
        elif key == BLOG_APPEARANCE_KEY:
            value = normalize_blog_appearance(value)
        row = session.exec(select(SiteConfig).where(SiteConfig.key == key)).first()
        if not row:
            row = SiteConfig(key=key, value=json.dumps(value, ensure_ascii=False))
        else:
            row.value = json.dumps(value, ensure_ascii=False)
        row.updated_at = datetime.now()
        session.add(row)
    session.commit()
    return get_all_config(session)
