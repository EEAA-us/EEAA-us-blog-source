"""Owner workflows against a fresh in-memory database; never use the blog database."""
import unittest
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy import event
from sqlmodel import SQLModel, Session, create_engine, select

from app.api import albums, auth, bookmarks, categories, posts, tags
from app.deps import get_current_user, get_optional_current_user, get_session
from app.models import Photo, Post, PostTag, User
from app.utils.auth import create_token, decode_token, hash_password
from app.models.bookmark import BookmarkSite


class ContentManagementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.app = FastAPI()
        for module in (albums, auth, bookmarks, categories, posts, tags):
            self.app.include_router(module.router)
        self.app.dependency_overrides[get_session] = lambda: self.session
        self.app.dependency_overrides[get_current_user] = lambda: {"sub": "admin", "admin": True}
        self.app.dependency_overrides[get_optional_current_user] = lambda: {"sub": "admin", "admin": True}
        self.client = TestClient(self.app, raise_server_exceptions=False)

    def tearDown(self):
        self.client.close()
        self.session.close()
        self.engine.dispose()

    def create(self, path, data):
        response = self.client.post(path, json=data)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_article_edit_filter_counts_and_delete(self):
        cat = self.create("/api/categories", {"name": "学习", "slug": "learning"})
        post = self.create("/api/posts", {"title": "first", "slug": "first", "content": "GPIO", "category_id": cat["id"], "tags": ["C"], "status": "published"})
        self.assertEqual(self.client.get("/api/categories").json()[0]["post_count"], 1)
        self.assertEqual(self.client.get("/api/tags").json()[0]["post_count"], 1)
        self.assertEqual(self.client.get("/api/posts", params={"search": "GPIO", "size": 1}).json()[0]["id"], post["id"])
        self.assertEqual(self.client.get("/api/posts/count", params={"search": "GPIO"}).json()["count"], 1)
        edited = self.client.put(f"/api/posts/{post['id']}", json={"title": "edited", "tags": [], "category_id": None})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertEqual(edited.json()["tags"], [])
        self.assertEqual(self.client.get("/api/categories").json()[0]["post_count"], 0)
        self.assertEqual(self.client.delete(f"/api/posts/{post['id']}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/posts/detail/{post['id']}").status_code, 404)

    def test_unknown_category_and_tag_return_no_articles(self):
        self.create("/api/posts", {"title": "first", "slug": "first"})
        for key in ("category", "tag"):
            self.assertEqual(self.client.get("/api/posts", params={key: "missing"}).json(), [])
        self.assertEqual(self.client.get("/api/posts/count", params={"category": "missing"}).json()["count"], 0)

    def test_repeated_tag_names_are_deduplicated(self):
        post = self.create("/api/posts", {"title": "first", "slug": "first", "tags": ["C", " C ", "c", ""]})
        self.assertEqual(post["tags"], ["C"])

    def test_deleting_article_and_tag_cleans_associations(self):
        post = self.create("/api/posts", {"title": "first", "slug": "first", "tags": ["C"]})
        self.assertEqual(self.client.delete(f"/api/posts/{post['id']}").status_code, 200)
        self.assertEqual(list(self.session.exec(select(PostTag))), [])
        self.assertEqual(self.client.get("/api/tags").json()[0]["post_count"], 0)
        post = self.create("/api/posts", {"title": "next", "slug": "next", "tags": ["C"]})
        tag = self.client.get("/api/tags").json()[0]
        self.assertEqual(self.client.delete(f"/api/tags/{tag['id']}").status_code, 200)
        self.assertEqual(list(self.session.exec(select(PostTag))), [])
        self.assertEqual(self.client.get(f"/api/posts/detail/{post['id']}").json()["tags"], [])

    def test_deleting_category_preserves_article_and_clears_relation(self):
        cat = self.create("/api/categories", {"name": "学习", "slug": "learning"})
        post = self.create("/api/posts", {"title": "first", "slug": "first", "category_id": cat["id"]})
        self.assertEqual(self.client.delete(f"/api/categories/{cat['id']}").status_code, 200)
        self.session.expire_all()
        self.assertIsNone(self.session.get(Post, post["id"]).category_id)

    def test_album_photo_counts_and_delete_cleanup(self):
        album = self.create("/api/albums", {"title": "test"})
        photo = self.create("/api/albums/photos", {"album_id": album["id"], "url": "/uploads/test.png"})
        self.assertEqual(self.client.get(f"/api/albums/{album['id']}").json()["photo_count"], 1)
        self.assertEqual(self.client.delete(f"/api/albums/photos/{photo['id']}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/albums/{album['id']}").json()["photo_count"], 0)
        self.create("/api/albums/photos", {"album_id": album["id"], "url": "/uploads/test.png"})
        self.assertEqual(self.client.delete(f"/api/albums/{album['id']}").status_code, 200)
        self.assertEqual(list(self.session.exec(select(Photo))), [])

    def test_photo_requires_existing_album(self):
        self.assertEqual(self.client.post("/api/albums/photos", json={"album_id": 999, "url": "/test.png"}).status_code, 404)
        self.assertEqual(list(self.session.exec(select(Photo))), [])

    def test_bookmarks_edit_and_category_delete_cleanup(self):
        cat = self.create("/api/bookmarks/categories", {"name": "test"})
        site = self.create("/api/bookmarks/sites", {"category_id": cat["id"], "name": "site", "url": "https://example.com", "platforms": ["web"]})
        edited = self.client.put(f"/api/bookmarks/sites/{site['id']}", json={"name": "changed", "platforms": ["desktop"]})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertEqual(self.client.get("/api/bookmarks").json()[0]["sites"][0]["platforms"], ["desktop"])
        self.assertEqual(self.client.delete(f"/api/bookmarks/categories/{cat['id']}").status_code, 200)
        self.assertEqual(list(self.session.exec(select(BookmarkSite))), [])

    def test_content_writes_require_authentication(self):
        self.app.dependency_overrides.pop(get_current_user)
        for path, data in (("/api/posts", {"title": "x", "slug": "x"}), ("/api/albums", {"title": "x"}), ("/api/tags", {"name": "x", "slug": "x"}), ("/api/categories", {"name": "x", "slug": "x"}), ("/api/bookmarks/categories", {"name": "x"})):
            self.assertEqual(self.client.post(path, json=data).status_code, 403)
            self.assertEqual(self.client.post(path, json=data, headers={"Authorization": "Bearer invalid"}).status_code, 401)

    def test_duplicate_names_and_slugs_are_clear_conflicts_and_preserve_content(self):
        for path, data in (("/api/posts", {"title": "x", "slug": "x"}), ("/api/tags", {"name": "x", "slug": "x"}), ("/api/categories", {"name": "x", "slug": "x"})):
            original = self.create(path, data)
            self.assertEqual(self.client.post(path, json=data).status_code, 409)
            self.assertEqual(self.client.get(path).json()[0]["id"], original["id"])

    def test_missing_parent_and_bad_pagination_are_rejected(self):
        self.assertEqual(self.client.post("/api/posts", json={"title": "x", "slug": "x", "category_id": 999}).status_code, 404)
        self.assertEqual(self.client.post("/api/bookmarks/sites", json={"category_id": 999, "name": "x", "url": "https://example.com"}).status_code, 404)
        for params in ({"page": 0}, {"size": 201}):
            self.assertEqual(self.client.get("/api/posts", params=params).status_code, 422)

    def test_real_login_owner_role_and_expiration_contract(self):
        self.session.add(User(username="test-owner", hashed_password=hash_password("isolated-password"), is_admin=True))
        self.session.commit()
        response = self.client.post("/api/auth/login", json={"username": "test-owner", "password": "isolated-password"})
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()["data"]
        expires = datetime.fromisoformat(data["expires"])
        self.assertIsNotNone(expires.tzinfo)
        self.assertLess(abs(expires.timestamp() - decode_token(data["accessToken"])["exp"]), 2)
        self.app.dependency_overrides.pop(get_current_user)
        owner_headers = {"Authorization": "Bearer " + data["accessToken"]}
        self.assertEqual(self.client.post("/api/albums", json={"title": "owner"}, headers=owner_headers).status_code, 200)
        nonowner = {"Authorization": "Bearer " + create_token({"sub": "visitor", "admin": False})}
        self.assertEqual(self.client.post("/api/albums", json={"title": "forbidden"}, headers=nonowner).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/login", json={"username": "test-owner", "password": "wrong"}).status_code, 401)

    def test_article_page_batches_category_and_tag_queries(self):
        category = self.create("/api/categories", {"name": "学习", "slug": "learning"})
        for index in range(25):
            self.create("/api/posts", {"title": str(index), "slug": str(index), "category_id": category["id"], "tags": ["C", "GPIO"]})
        self.session.expire_all()
        queries = []
        def record(connection, cursor, statement, parameters, context, many):
            if statement.lstrip().upper().startswith("SELECT"):
                queries.append(statement)
        event.listen(self.engine, "before_cursor_execute", record)
        try:
            response = self.client.get("/api/posts", params={"size": 20})
        finally:
            event.remove(self.engine, "before_cursor_execute", record)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 20)
        self.assertTrue(all(post["category"] == "学习" and set(post["tags"]) == {"C", "GPIO"} for post in response.json()))
        self.assertLessEqual(len(queries), 3)
