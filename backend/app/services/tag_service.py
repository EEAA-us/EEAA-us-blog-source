from sqlmodel import Session, select, func
from fastapi import HTTPException

from app.models import Tag, PostTag, Post
from app.schemas import TagCreate, TagUpdate


def get_tags(session: Session, *, published_only: bool = False) -> list[Tag] | list[dict]:
    tags = list(session.exec(select(Tag).order_by(Tag.post_count.desc())).all())
    if not published_only:
        return tags
    counts = dict(session.exec(select(PostTag.tag_id, func.count(PostTag.post_id))
                               .join(Post, Post.id == PostTag.post_id)
                               .where(Post.status == "published").group_by(PostTag.tag_id)).all())
    return sorted(({**tag.model_dump(), "post_count": counts.get(tag.id, 0)} for tag in tags),
                  key=lambda tag: -tag["post_count"])


def create_tag(session: Session, data: TagCreate) -> Tag:
    if session.exec(select(Tag).where((Tag.name == data.name) | (Tag.slug == data.slug))).first():
        raise HTTPException(409, "标签名称或 URL 别名已存在")
    tag = Tag(**data.model_dump())
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def update_tag(session: Session, tag_id: int, data: TagUpdate) -> Tag:
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    for field in ("name", "slug"):
        value = getattr(data, field)
        if value is not None and session.exec(select(Tag).where(getattr(Tag, field) == value, Tag.id != tag_id)).first():
            raise HTTPException(409, "标签名称或 URL 别名已存在")
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(tag, k, v)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def delete_tag(session: Session, tag_id: int):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    for link in session.exec(select(PostTag).where(PostTag.tag_id == tag_id)).all():
        session.delete(link)
    session.flush()
    session.delete(tag)
    session.commit()
