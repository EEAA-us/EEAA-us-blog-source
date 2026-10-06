from datetime import datetime
from sqlmodel import Session, select, func, or_
from fastapi import HTTPException

from app.models import Post, Category, Tag, PostTag
from app.schemas import PostCreate, PostUpdate


def _sync_tags(session: Session, post_id: int, tag_names: list[str]):
    """同步文章标签：删除旧关联，创建新标签（如不存在），建立关联。"""
    # 删除旧关联
    old = session.exec(select(PostTag).where(PostTag.post_id == post_id)).all()
    for pt in old:
        session.delete(pt)

    seen = set()
    linked_ids = set()
    session.flush()
    for name in tag_names:
        name = name.strip()
        slug = name.lower().replace(" ", "-")
        if not name or slug in seen:
            continue
        seen.add(slug)
        tag = session.exec(select(Tag).where((Tag.name == name) | (Tag.slug == slug))).first()
        if not tag:
            tag = Tag(name=name, slug=slug)
            session.add(tag)
            session.flush()
        assert tag.id is not None
        if tag.id in linked_ids:
            continue
        linked_ids.add(tag.id)
        session.add(PostTag(post_id=post_id, tag_id=tag.id))

    # 更新标签计数
    _update_tag_counts(session, {pt.tag_id for pt in old} | linked_ids)


def _update_tag_counts(session: Session, tag_ids: set[int] | None = None):
    session.flush()
    if tag_ids is not None and not tag_ids:
        return
    count_query = select(PostTag.tag_id, func.count(PostTag.post_id))
    tag_query = select(Tag)
    if tag_ids is not None:
        count_query = count_query.where(PostTag.tag_id.in_(tag_ids))
        tag_query = tag_query.where(Tag.id.in_(tag_ids))
    counts = dict(session.exec(
        count_query.group_by(PostTag.tag_id)
    ).all())
    for tag in session.exec(tag_query).all():
        tag.post_count = counts.get(tag.id, 0)
        session.add(tag)


def _update_category_count(session: Session, category_id: int | None):
    if category_id is None:
        return
    cat = session.get(Category, category_id)
    if cat:
        count = session.exec(
            select(func.count(Post.id)).where(Post.category_id == category_id)
        ).one()
        cat.post_count = count
        session.add(cat)


def _post_to_dict(post: Post, session: Session, category_name: str | None = None, tag_names: list[str] | None = None) -> dict:
    """将 Post 对象转为带 category 和 tags 的字典。"""
    cat_name = category_name or ""
    if category_name is None and post.category_id:
        cat = session.get(Category, post.category_id)
        if cat:
            cat_name = cat.name

    if tag_names is None:
        tag_names = []
        pts = session.exec(select(PostTag).where(PostTag.post_id == post.id)).all()
        for pt in pts:
            tag = session.get(Tag, pt.tag_id)
            if tag:
                tag_names.append(tag.name)

    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "description": post.description,
        "content": post.content,
        "cover": post.cover,
        "category": cat_name,
        "tags": tag_names,
        "status": post.status,
        "is_pinned": post.is_pinned,
        "views": post.views,
        "likes": post.likes,
        "word_count": post.word_count,
        "reading_time": post.reading_time,
        "published_at": post.published_at,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    }


def _filtered_posts_query(
    session: Session,
    status: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    search: str | None = None,
):
    q = select(Post)
    if status:
        q = q.where(Post.status == status)
    if category:
        cat = session.exec(select(Category).where(Category.slug == category)).first()
        if cat and cat.id is not None:
            q = q.where(Post.category_id == cat.id)
        else:
            q = q.where(False)
    if tag:
        t = session.exec(select(Tag).where(Tag.slug == tag)).first()
        if t and t.id is not None:
            post_ids = [
                pt.post_id
                for pt in session.exec(
                    select(PostTag).where(PostTag.tag_id == t.id)
                ).all()
            ]
            q = q.where(Post.id.in_(post_ids))
        else:
            q = q.where(False)

    for keyword in (search or "").strip().split():
        matching_category_ids = [
            category_id
            for category_id in session.exec(
                select(Category.id).where(Category.name.contains(keyword))
            ).all()
            if category_id is not None
        ]
        matching_tag_ids = [
            tag_id
            for tag_id in session.exec(
                select(Tag.id).where(Tag.name.contains(keyword))
            ).all()
            if tag_id is not None
        ]
        matching_post_ids = [
            post_id
            for post_id in session.exec(
                select(PostTag.post_id).where(PostTag.tag_id.in_(matching_tag_ids))
            ).all()
        ] if matching_tag_ids else []
        q = q.where(or_(
            Post.title.contains(keyword),
            Post.description.contains(keyword),
            Post.content.contains(keyword),
            Post.category_id.in_(matching_category_ids),
            Post.id.in_(matching_post_ids),
        ))

    return q


def get_posts(
    session: Session,
    status: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 10,
) -> list[dict]:
    q = _filtered_posts_query(session, status, category, tag, search)
    q = q.order_by(Post.is_pinned.desc(), Post.created_at.desc())
    q = q.offset((page - 1) * size).limit(size)
    posts = list(session.exec(q).all())
    if not posts:
        return []
    category_ids = {post.category_id for post in posts if post.category_id is not None}
    category_names = {
        category.id: category.name
        for category in session.exec(select(Category).where(Category.id.in_(category_ids))).all()
    } if category_ids else {}
    tags_by_post = {post.id: [] for post in posts}
    for post_id, tag_name in session.exec(
        select(PostTag.post_id, Tag.name).join(Tag, Tag.id == PostTag.tag_id)
        .where(PostTag.post_id.in_(tags_by_post))
    ).all():
        tags_by_post[post_id].append(tag_name)
    return [_post_to_dict(post, session, category_names.get(post.category_id, ""), tags_by_post[post.id]) for post in posts]


def get_post_by_slug(session: Session, slug: str) -> dict:
    post = session.exec(select(Post).where(Post.slug == slug)).first()
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    post.views += 1
    session.add(post)
    session.commit()
    session.refresh(post)
    return _post_to_dict(post, session)


def get_post_by_id(session: Session, post_id: int) -> dict:
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    return _post_to_dict(post, session)


def create_post(session: Session, data: PostCreate) -> dict:
    if session.exec(select(Post).where(Post.slug == data.slug)).first():
        raise HTTPException(409, "文章 URL 别名已存在，请换一个")
    if data.category_id is not None and not session.get(Category, data.category_id):
        raise HTTPException(404, "分类不存在")
    tag_names = data.tags
    post_data = data.model_dump(exclude={"tags"})
    post = Post(**post_data)

    # 自动计算字数和阅读时间（仅当未手动指定时）
    if post.content:
        if not post.word_count:
            post.word_count = len(post.content)
        if not post.reading_time:
            post.reading_time = max(1, post.word_count // 300)

    if post.status == "published" and not post.published_at:
        post.published_at = datetime.now()

    session.add(post)
    session.flush()

    if tag_names:
        _sync_tags(session, post.id, tag_names)
    if post.category_id:
        _update_category_count(session, post.category_id)

    session.commit()
    session.refresh(post)
    return _post_to_dict(post, session)


def update_post(session: Session, post_id: int, data: PostUpdate) -> dict:
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    tag_names = data.tags
    update_data = data.model_dump(exclude_unset=True, exclude={"tags"})
    if "slug" in update_data and session.exec(select(Post).where(Post.slug == data.slug, Post.id != post_id)).first():
        raise HTTPException(409, "文章 URL 别名已存在，请换一个")
    if data.category_id is not None and not session.get(Category, data.category_id):
        raise HTTPException(404, "分类不存在")

    old_category = post.category_id
    for k, v in update_data.items():
        setattr(post, k, v)

    if post.content:
        if "word_count" not in update_data:
            post.word_count = len(post.content)
        if "reading_time" not in update_data:
            post.reading_time = max(1, post.word_count // 300)

    if post.status == "published" and not post.published_at:
        post.published_at = datetime.now()

    post.updated_at = datetime.now()
    session.add(post)
    session.flush()

    if tag_names is not None:
        _sync_tags(session, post.id, tag_names)

    _update_category_count(session, old_category)
    _update_category_count(session, post.category_id)

    session.commit()
    session.refresh(post)
    return _post_to_dict(post, session)


def delete_post(session: Session, post_id: int):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    cat_id = post.category_id
    links = session.exec(select(PostTag).where(PostTag.post_id == post_id)).all()
    affected_tags = {link.tag_id for link in links}
    for link in links:
        session.delete(link)
    session.delete(post)
    session.flush()
    _update_category_count(session, cat_id)
    _update_tag_counts(session, affected_tags)
    session.commit()


def count_posts(
    session: Session,
    status: str | None = None,
    category: str | None = None,
    search: str | None = None,
) -> int:
    filtered = _filtered_posts_query(session, status, category, search=search)
    return session.exec(select(func.count()).select_from(filtered.subquery())).one()


def toggle_like(session: Session, post_id: int, unlike: bool = False) -> dict:
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(404, "文章不存在")
    post.likes = max(0, post.likes + (-1 if unlike else 1))
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"likes": post.likes}
