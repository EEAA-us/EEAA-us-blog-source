"""Validation contract for the public dynamic hero media catalog."""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")
_VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"}


def _valid_url(value: str, *, required: bool = True) -> str:
    value = value.strip()
    if not value and not required:
        return value
    if not value or len(value) > 2048 or "\\" in value or any(ord(ch) < 32 for ch in value):
        raise ValueError("URL must be non-empty, at most 2048 characters, and contain no controls")
    parsed = urlparse(value)
    if value.startswith("//") or parsed.scheme.lower() == "javascript":
        raise ValueError("URL scheme is not allowed")
    if parsed.scheme:
        if parsed.scheme.lower() != "https" or not parsed.netloc:
            raise ValueError("Only HTTPS or root-relative URLs are allowed")
    elif not value.startswith("/") or parsed.netloc:
        raise ValueError("Only HTTPS or root-relative URLs are allowed")
    return value


class CatalogModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HeroMediaCategory(CatalogModel):
    id: str
    name: str = Field(min_length=1, max_length=80)
    order: int = Field(ge=0, le=10000)
    enabled: bool

    @field_validator("id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        if not _ID.fullmatch(value):
            raise ValueError("ID must use letters, digits, underscore, or hyphen")
        return value


class HeroMediaItem(CatalogModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    category: str
    kind: Literal["video", "gif"]
    url: str
    poster: str = ""
    author: str | None = Field(default=None, max_length=120)
    sourceUrl: str | None = Field(default=None, max_length=2048)
    licenseUrl: str | None = Field(default=None, max_length=2048)
    order: int = Field(ge=0, le=10000)
    enabled: bool

    @field_validator("id", "category")
    @classmethod
    def valid_id(cls, value: str) -> str:
        if not _ID.fullmatch(value):
            raise ValueError("ID must use letters, digits, underscore, or hyphen")
        return value

    @field_validator("url")
    @classmethod
    def valid_media_url(cls, value: str) -> str:
        return _valid_url(value)

    @field_validator("poster")
    @classmethod
    def valid_poster(cls, value: str) -> str:
        return _valid_url(value, required=False)

    @field_validator("sourceUrl", "licenseUrl")
    @classmethod
    def valid_metadata_url(cls, value: str | None) -> str | None:
        return _valid_url(value, required=False) if value is not None else None

    @model_validator(mode="after")
    def extension_matches_kind(self):
        extension = urlparse(self.url).path.rsplit("/", 1)[-1].lower()
        if self.kind == "gif" and not extension.endswith(".gif"):
            raise ValueError("GIF items must use a .gif URL")
        if self.kind == "video" and not any(extension.endswith(ext) for ext in _VIDEO_EXTENSIONS):
            raise ValueError("Video items must use a supported video extension")
        return self


class HeroMediaCatalog(CatalogModel):
    version: Literal[1]
    categories: list[HeroMediaCategory] = Field(max_length=50)
    items: list[HeroMediaItem] = Field(max_length=200)

    @model_validator(mode="after")
    def valid_relations(self):
        category_ids = [category.id for category in self.categories]
        item_ids = [item.id for item in self.items]
        if len(category_ids) != len(set(category_ids)):
            raise ValueError("Category IDs must be unique")
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("Item IDs must be unique")
        known = set(category_ids)
        if any(item.category not in known for item in self.items):
            raise ValueError("Every item must reference an existing category")
        return self
