"""Disposable in-memory scale check. Run directly; never connects to the blog DB."""
import json, time
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine
from app.api import posts, tags, albums, bookmarks
from app.deps import get_session
from app.models import Post, Category, Tag, PostTag, Album, Photo
from app.models.bookmark import BookmarkCategory, BookmarkSite
from app.services.post_service import _update_tag_counts

engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
SQLModel.metadata.create_all(engine)
with engine.begin() as connection:
    for model, data in [
        (Category, [Category(id=i+1, name=f'category-{i}', slug=f'category-{i}').model_dump() for i in range(100)]),
        (Tag, [Tag(id=i+1, name=f'tag-{i}', slug=f'tag-{i}').model_dump() for i in range(2000)]),
        (Post, [Post(id=i+1, title=f'post-{i}', slug=f'post-{i}', content='body ' * 1000, category_id=i%100+1, status='published').model_dump() for i in range(10000)]),
        (PostTag, [PostTag(post_id=i+1, tag_id=i%2000+1).model_dump() for i in range(10000)]),
        (Album, [Album(id=1, title='large', photo_count=10000).model_dump()]),
        (Photo, [Photo(album_id=1, url=f'/test/{i}.webp', sort=i).model_dump() for i in range(10000)]),
        (BookmarkCategory, [BookmarkCategory(id=i+1, name=f'group-{i}', sort=i).model_dump() for i in range(500)]),
        (BookmarkSite, [BookmarkSite(category_id=i%500+1, name=f'site-{i}', url='https://example.com', sort=i, platforms='["web"]').model_dump() for i in range(10000)]),
    ]:
        connection.execute(model.__table__.insert(), data)

queries = []
def record(connection, cursor, statement, parameters, context, many):
    if statement.lstrip().upper().startswith('SELECT'):
        queries.append(statement)
event.listen(engine, 'before_cursor_execute', record)
results = []
with Session(engine) as session:
    app = FastAPI()
    for module in (posts, tags, albums, bookmarks):
        app.include_router(module.router)
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        for path, expected in [('/api/posts?size=20&page=1',20), ('/api/posts?size=20&page=500',20), ('/api/posts?size=20&page=501',0), ('/api/posts/count',10000), ('/api/tags',2000), ('/api/albums/1/photos',10000), ('/api/bookmarks',500)]:
            timings = []
            for repeat in range(3):
                session.expire_all()
                queries.clear()
                start = time.perf_counter()
                response = client.get(path)
                timings.append(round((time.perf_counter()-start)*1000, 2))
                assert response.status_code == 200, response.text[:300]
                payload = response.json()
                actual = payload['count'] if isinstance(payload, dict) else len(payload)
                assert actual == expected, (path, actual)
                if path == '/api/bookmarks':
                    assert sum(len(group['sites']) for group in payload) == 10000
                if path.startswith('/api/posts?'):
                    assert all(row['tags'] and row['category'] for row in payload)
            results.append({'path':path, 'status':'pass', 'rows':actual, 'milliseconds':timings, 'selects':len(queries), 'response_bytes':len(response.content)})
        queries.clear()
        start = time.perf_counter()
        _update_tag_counts(session)
        session.flush()
        results.append({'operation':'recount 2000 tags / 10000 links', 'status':'pass', 'milliseconds':round((time.perf_counter()-start)*1000,2), 'selects':len(queries)})
        session.rollback()
engine.dispose()
print(json.dumps(results, ensure_ascii=False, indent=2))
Path(__file__).resolve().parents[2].joinpath('.publish/large-content-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
