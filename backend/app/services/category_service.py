from datetime import datetime
from sqlmodel import Session, select, func
from fastapi import HTTPException

from app.models import Category, Post
from app.schemas import CategoryCreate, CategoryUpdate


def get_categories(session: Session, *, published_only: bool = False) -> list[Category] | list[dict]:
    categories = list(session.exec(select(Category).order_by(Category.sort)).all())
    if not published_only:
        return categories
    counts = dict(session.exec(select(Post.category_id, func.count(Post.id))
                               .where(Post.status == "published").group_by(Post.category_id)).all())
    return [{**category.model_dump(), "post_count": counts.get(category.id, 0)} for category in categories]


def get_category_by_id(session: Session, cat_id: int) -> Category:
    cat = session.get(Category, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    return cat


def create_category(session: Session, data: CategoryCreate) -> Category:
    if session.exec(select(Category).where((Category.name == data.name) | (Category.slug == data.slug))).first():
        raise HTTPException(409, "分类名称或 URL 别名已存在")
    cat = Category(**data.model_dump())
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


def update_category(session: Session, cat_id: int, data: CategoryUpdate) -> Category:
    cat = session.get(Category, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    for field in ("name", "slug"):
        value = getattr(data, field)
        if value is not None and session.exec(select(Category).where(getattr(Category, field) == value, Category.id != cat_id)).first():
            raise HTTPException(409, "分类名称或 URL 别名已存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    cat.updated_at = datetime.now()
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


def delete_category(session: Session, cat_id: int):
    cat = session.get(Category, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    for post in session.exec(select(Post).where(Post.category_id == cat_id)).all():
        post.category_id = None
        session.add(post)
    session.flush()
    session.delete(cat)
    session.commit()
