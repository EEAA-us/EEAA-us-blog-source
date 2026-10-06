"""Shared catalog parsing, validation, and persistence helpers."""

import json
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError
from sqlmodel import Session, select

from app.models import SiteConfig
from app.schemas.hero_media_catalog import HeroMediaCatalog

KEY = "heroMediaCatalog"
DEFAULTS_PATH = Path(__file__).resolve().parents[2] / ".." / "public" / "hero-media-defaults.json"
EMPTY_CATALOG = {"version": 1, "categories": [], "items": []}


def normalize_catalog(value) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="heroMediaCatalog must contain valid JSON") from exc
    try:
        return HeroMediaCatalog.model_validate(value).model_dump(by_alias=True, exclude_none=True)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_context=False)) from exc


def get_catalog(session: Session) -> dict:
    row = session.exec(select(SiteConfig).where(SiteConfig.key == KEY)).first()
    if row is not None:
        return normalize_catalog(row.value)
    if DEFAULTS_PATH.is_file():
        try:
            return normalize_catalog(DEFAULTS_PATH.read_text(encoding="utf-8"))
        except HTTPException as exc:
            raise HTTPException(status_code=500, detail="Bundled hero media defaults are invalid") from exc
    return EMPTY_CATALOG.copy()


def save_catalog(session: Session, value) -> dict:
    catalog = normalize_catalog(value)
    row = session.exec(select(SiteConfig).where(SiteConfig.key == KEY)).first()
    encoded = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
    if row is None:
        row = SiteConfig(key=KEY, value=encoded, description="动态封面媒体目录")
    else:
        row.value = encoded
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    return catalog
