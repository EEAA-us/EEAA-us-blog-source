"""Loopback-only API used by the local Codex MCP server."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlmodel import Session

from app.database import get_session
from app.services import ai_service


router = APIRouter(prefix="/api/ai", tags=["本机 AI"])


class DraftPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_updated_at: datetime
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    content: str | None = Field(default=None, max_length=2_000_000)

    @model_validator(mode="after")
    def validate_patch(self):
        changes = self.model_dump(exclude={"expected_updated_at"}, exclude_unset=True)
        if not changes:
            raise ValueError("至少提供一个可修改字段")
        if "title" in changes and (changes["title"] is None or not changes["title"].strip()):
            raise ValueError("标题不能为空")
        if any(value is None for value in changes.values()):
            raise ValueError("可修改字段不能为 null")
        return self

    def changes(self) -> dict[str, str]:
        return self.model_dump(exclude={"expected_updated_at"}, exclude_unset=True)


class DraftRestore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_updated_at: datetime


def _authorize(token_name: str):
    def dependency(
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> None:
        ai_service.authorize_local_request(request, authorization, token_name)

    return dependency


require_read = _authorize("BLOG_AI_READ_TOKEN")
require_draft = _authorize("BLOG_AI_DRAFT_TOKEN")


@router.get("/stats")
def stats(
    response: Response,
    start: str = Query(..., min_length=10, max_length=10),
    end: str = Query(..., min_length=10, max_length=10),
    _: None = Depends(require_read),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Vary"] = "Authorization"
    start_date = ai_service.parse_iso_date(start)
    end_date = ai_service.parse_iso_date(end)
    result = ai_service.get_statistics(start_date, end_date)
    return result


@router.get("/posts")
def drafts(
    response: Response,
    search: str = Query(default="", max_length=200),
    status: Literal["draft"] = "draft",
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=50),
    _: None = Depends(require_read),
    session: Session = Depends(get_session),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Vary"] = "Authorization"
    return ai_service.search_drafts(session, search, page, size)


@router.get("/posts/{post_id}")
def post_detail(
    post_id: int,
    response: Response,
    _: None = Depends(require_read),
    session: Session = Depends(get_session),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Vary"] = "Authorization"
    return ai_service.read_post(session, post_id)


@router.patch("/drafts/{post_id}")
def patch_draft(
    post_id: int,
    patch: DraftPatch,
    response: Response,
    _: None = Depends(require_draft),
    session: Session = Depends(get_session),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Vary"] = "Authorization"
    return ai_service.update_draft(session, post_id, patch.expected_updated_at, patch.changes())


@router.patch("/drafts/{post_id}/restore/{revision_id}")
def restore_draft(
    post_id: int,
    revision_id: int,
    body: DraftRestore,
    response: Response,
    _: None = Depends(require_draft),
    session: Session = Depends(get_session),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Vary"] = "Authorization"
    return ai_service.restore_draft_revision(session, post_id, revision_id, body.expected_updated_at)
