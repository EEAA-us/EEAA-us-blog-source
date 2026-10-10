"""Validation for the public blog appearance defaults."""

from __future__ import annotations

import json
import math
import re
from typing import Any, Literal
from urllib.parse import unquote, urlparse

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


PREFERENCES_MAX_BYTES = 48 * 1024
PREFERENCE_KEYS = {
    "hue", "themeColorMode", "themeHex", "colorStyle", "colorSpec", "themeColorSpread",
    "layout", "background", "texture", "textureOpacity", "opacity", "waves", "coverEffect",
    "waveSpeed", "waveOpacity", "waveBackOpacity", "waveLayerStyle", "waveAmplitude", "waveLayers",
    "reduceMotion", "fontStyle", "homeTextScale", "homeCardColor", "homeCardHex", "homeCardHue",
    "themeTransitionDuration", "themeTransitionDirection",
    "homeCardStyle", "homeCardTone", "homeTextWeight", "articleTextScale", "articleTextWeight",
    "navigationTextScale", "navigationTextWeight", "coverTextWeight", "coverTitleScale",
    "coverSubtitleScale", "heroMode", "heroInterval", "heroMediaKind", "heroMediaUrl", "heroSlides",
    "heroCustomMedia", "navigationScroll", "language", "subtitleLanguage", "subtitleEffect",
    "welcomeEnabled", "articleHoverGuide", "articleHoverFrame", "readingLayout", "readingPageWidth",
    "readingContentWidth", "focusContentWidth", "live2dCharacter",
}
_URL_KEYS = {"heroMediaUrl", "heroSlides"}
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_BOOLEAN_KEYS = {
    "themeColorSpread", "waves", "reduceMotion", "welcomeEnabled", "articleHoverGuide", "articleHoverFrame",
}
_NUMBER_KEYS = {
    "hue", "textureOpacity", "opacity", "waveSpeed", "waveOpacity", "waveBackOpacity", "waveAmplitude",
    "waveLayers", "homeTextScale", "homeCardHue", "articleTextScale", "navigationTextScale",
    "coverTitleScale", "coverSubtitleScale", "heroInterval", "readingPageWidth", "readingContentWidth",
    "focusContentWidth",
    "themeTransitionDuration",
}
_STRING_KEYS = PREFERENCE_KEYS - _BOOLEAN_KEYS - _NUMBER_KEYS - _URL_KEYS - {"heroCustomMedia"}


def _validate_url(value: str) -> str:
    if value == "":
        return value
    if len(value) > 2048 or not value or "\\" in value or any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ValueError("URL must be non-empty, at most 2048 characters, and contain no controls")
    parsed = urlparse(value)
    if value.startswith("//") or parsed.scheme:
        if parsed.scheme.lower() != "https" or not parsed.netloc:
            raise ValueError("Only HTTPS or root-relative URLs are allowed")
    elif not value.startswith("/") or parsed.netloc:
        raise ValueError("Only HTTPS or root-relative URLs are allowed")
    decoded = unquote(parsed.path)
    if "\\" in decoded:
        raise ValueError("URL path separators are not allowed")
    if any(part in {".", ".."} for part in decoded.split("/")):
        raise ValueError("URL path traversal is not allowed")
    return value


def _json_safe(value: Any, depth: int = 0, *, top_level: bool = False) -> bool:
    if depth > 8:
        return False
    if value is None or isinstance(value, (str, bool, int, float)):
        return not isinstance(value, float) or math.isfinite(value)
    if isinstance(value, list):
        return len(value) <= 200 and all(_json_safe(item, depth + 1) for item in value)
    if isinstance(value, dict):
        limit = len(PREFERENCE_KEYS) if top_level else 32
        return len(value) <= limit and all(isinstance(k, str) and _json_safe(v, depth + 1) for k, v in value.items())
    return False


def normalize_preferences(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("preferences must be an object")
    if "live2dPosition" in value:
        raise ValueError("live2dPosition is visitor-local and cannot be published")
    unknown = set(value) - PREFERENCE_KEYS
    if unknown:
        raise ValueError(f"Unsupported appearance preference: {sorted(unknown)[0]}")
    if not _json_safe(value, top_level=True):
        raise ValueError("preferences must contain only bounded JSON values")
    for key, item in value.items():
        if key in _BOOLEAN_KEYS and not isinstance(item, bool):
            raise ValueError(f"{key} must be a boolean")
        if key in _NUMBER_KEYS and (isinstance(item, bool) or not isinstance(item, (int, float))):
            raise ValueError(f"{key} must be a number")
        if key in _STRING_KEYS and not isinstance(item, str):
            raise ValueError(f"{key} must be a string")
        if isinstance(item, str) and len(item) > 2048:
            raise ValueError(f"{key} is too long")
        if key in {"themeHex", "homeCardHex"} and not _HEX.fullmatch(item):
            raise ValueError(f"{key} must be a six-digit hexadecimal color")
        if key == "heroSlides" and (not isinstance(item, list) or len(item) > 50):
            raise ValueError("heroSlides must be a list with at most 50 URLs")
        if key == "heroCustomMedia" and not isinstance(item, list):
            raise ValueError("heroCustomMedia must be a list")
        if key == "themeTransitionDuration" and not 200 <= item <= 1600:
            raise ValueError("themeTransitionDuration must be between 200 and 1600 ms")
        if key == "themeTransitionDirection" and item not in {"top-left", "top-right", "bottom-left", "bottom-right", "top", "bottom", "left", "right"}:
            raise ValueError("Unsupported themeTransitionDirection")
    try:
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ValueError("preferences must be JSON serializable") from exc
    if len(encoded) > PREFERENCES_MAX_BYTES:
        raise ValueError("preferences exceed the size limit")
    for key in _URL_KEYS:
        if key not in value:
            continue
        values = value[key] if isinstance(value[key], list) else [value[key]]
        for url in values:
            if not isinstance(url, str):
                raise ValueError(f"{key} values must be URLs")
            _validate_url(url)
    custom = value.get("heroCustomMedia", [])
    if not isinstance(custom, list) or len(custom) > 50:
        raise ValueError("heroCustomMedia must be a list with at most 50 items")
    for item in custom:
        if not isinstance(item, dict) or set(item) != {"id", "name", "url", "kind"}:
            raise ValueError("heroCustomMedia items must contain id, name, url, and kind")
        if not all(isinstance(item.get(k), str) and item[k] for k in ("id", "name")) or item["kind"] not in {"video", "gif"}:
            raise ValueError("Invalid heroCustomMedia item")
        _validate_url(item["url"])
    return value


class BlogBackgroundDefaults(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image: str
    blur: float = 20

    @field_validator("image")
    @classmethod
    def valid_image(cls, value):
        return _validate_url(value)

    @field_validator("blur")
    @classmethod
    def valid_blur(cls, value):
        if not math.isfinite(value) or not 0 <= value <= 20:
            raise ValueError("Background blur must be between 0 and 20")
        return value


class BlogEffectDefaults(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    clickEffect: bool = True
    mouseTrail: bool = False
    sparkleEffect: bool = False
    fallingEffect: Literal["none", "seasonal", "sakura", "ginkgo", "snow", "stardust", "feathers", "constellation"] = "none"


class BlogAppearanceDefaults(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferences: dict[str, Any] = {}
    theme: Literal["light", "dark", "system"] = "system"
    background: BlogBackgroundDefaults | None = None
    effects: BlogEffectDefaults | None = None

    @field_validator("preferences")
    @classmethod
    def valid_preferences(cls, value):
        return normalize_preferences(value)

    @model_validator(mode="after")
    def size_guard(self):
        if len(json.dumps(self.model_dump(), ensure_ascii=False, allow_nan=False).encode("utf-8")) > PREFERENCES_MAX_BYTES + 4096:
            raise ValueError("blog appearance defaults exceed the size limit")
        return self
