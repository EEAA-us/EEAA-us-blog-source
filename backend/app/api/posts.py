from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.deps import get_session
from app.schemas import PostCreate, PostUpdate, PostOut, PostDetail
from app.services import post_service
from app.deps import get_current_user, get_optional_current_user

router = APIRouter(prefix="/api/posts", tags=["文章"])


def _visible_status(status: str | None, owner: dict | None) -> str | None:
    if owner is not None:
        return status
    if status and status != "published":
        raise HTTPException(403, "仅站长可以读取非公开文章")
    return "published"


@router.get("", response_model=list[PostOut])
def list_posts(
    status: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    search: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=200),
    session: Session = Depends(get_session),
    owner: dict | None = Depends(get_optional_current_user),
):
    return post_service.get_posts(session, _visible_status(status, owner), category, tag, search, page, size)


@router.get("/count")
def post_count(
    status: str | None = None,
    category: str | None = None,
    search: str | None = Query(None, max_length=100),
    session: Session = Depends(get_session),
    owner: dict | None = Depends(get_optional_current_user),
):
    return {"count": post_service.count_posts(session, _visible_status(status, owner), category, search)}


@router.get("/detail/{post_id}", response_model=PostDetail)
def get_post_by_id(post_id: int, session: Session = Depends(get_session), owner: dict | None = Depends(get_optional_current_user)):
    return post_service.get_post_by_id(session, post_id, include_unpublished=owner is not None)


@router.get("/{slug}", response_model=PostDetail)
def get_post(slug: str, session: Session = Depends(get_session), owner: dict | None = Depends(get_optional_current_user)):
    return post_service.get_post_by_slug(session, slug, include_unpublished=owner is not None)


@router.post("", response_model=PostOut)
def create_post(
    data: PostCreate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return post_service.create_post(session, data)


@router.put("/{post_id}", response_model=PostOut)
def update_post(
    post_id: int,
    data: PostUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return post_service.update_post(session, post_id, data)


@router.post("/{post_id}/like")
def like_post(post_id: int, session: Session = Depends(get_session)):
    return post_service.toggle_like(session, post_id, unlike=False)


@router.post("/{post_id}/unlike")
def unlike_post(post_id: int, session: Session = Depends(get_session)):
    return post_service.toggle_like(session, post_id, unlike=True)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    post_service.delete_post(session, post_id)
    return {"ok": True}
