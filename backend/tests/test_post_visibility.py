"""Public/owner article boundaries with real tokens and an isolated database."""
import unittest
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api import auth, categories, posts, tags
from app.config import ALGORITHM, SECRET_KEY
from app.deps import get_session
from app.models import Category, Post, PostTag, Tag, User
from app.utils.auth import create_token, hash_password


class PostVisibilityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.session.add(Category(id=1, name="shared", slug="shared", post_count=3))
        self.session.add(Tag(id=1, name="shared", slug="shared", post_count=3))
        self.session.add(User(username="owner", is_admin=True, hashed_password=hash_password("isolated-owner-password")))
        for index, status in enumerate(("published", "draft", "archived"), 1):
            self.session.add(Post(id=index, title=status, slug=status, content="private-marker-" + status,
                                  status=status, category_id=1, views=5, likes=3))
            self.session.add(PostTag(post_id=index, tag_id=1))
        self.session.commit()
        self.app = FastAPI()
        for module in (auth, posts, categories, tags):
            self.app.include_router(module.router)
        self.app.dependency_overrides[get_session] = lambda: self.session
        self.client = TestClient(self.app)
        self.owner = {"Authorization": "Bearer " + create_token({"sub": "owner", "admin": True})}

    def tearDown(self):
        self.client.close()
        self.session.close()
        self.engine.dispose()

    def test_anonymous_list_count_and_search_only_include_published(self):
        for params in ({}, {"status": "published"}, {"category": "shared"}, {"tag": "shared"}):
            response = self.client.get("/api/posts", params=params)
            self.assertEqual(response.status_code, 200)
            self.assertEqual([row["id"] for row in response.json()], [1])
        self.assertEqual(self.client.get("/api/posts/count").json(), {"count": 1})
        for marker in ("private-marker-draft", "private-marker-archived"):
            self.assertEqual(self.client.get("/api/posts", params={"search": marker}).json(), [])
            self.assertEqual(self.client.get("/api/posts/count", params={"search": marker}).json(), {"count": 0})

    def test_anonymous_cannot_request_nonpublic_status(self):
        for status in ("draft", "archived", "anything"):
            for path in ("/api/posts", "/api/posts/count"):
                self.assertEqual(self.client.get(path, params={"status": status}).status_code, 403)

    def test_nonpublic_details_and_likes_return_404_without_mutation(self):
        for post_id, slug in ((2, "draft"), (3, "archived")):
            for path in (f"/api/posts/detail/{post_id}", f"/api/posts/{slug}"):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)
                self.assertNotIn("private-marker", response.text)
            for action in ("like", "unlike"):
                self.assertEqual(self.client.post(f"/api/posts/{post_id}/{action}").status_code, 404)
            self.session.expire_all()
            row = self.session.get(Post, post_id)
            self.assertEqual((row.views, row.likes), (5, 3))

    def test_public_details_and_likes_keep_working_without_login(self):
        self.assertEqual(self.client.get("/api/posts/detail/1").status_code, 200)
        self.assertEqual(self.client.get("/api/posts/published").status_code, 200)
        self.assertEqual(self.client.post("/api/posts/1/like").json(), {"likes": 4})
        self.assertEqual(self.client.post("/api/posts/1/unlike").json(), {"likes": 3})
        self.session.expire_all()
        self.assertEqual(self.session.get(Post, 1).views, 6)

    def test_owner_can_list_count_read_and_edit_nonpublic_articles(self):
        response = self.client.post("/api/auth/login", json={"username": "owner", "password": "isolated-owner-password"})
        self.assertEqual(response.status_code, 200)
        headers = {"Authorization": "Bearer " + response.json()["data"]["accessToken"]}
        self.assertEqual(len(self.client.get("/api/posts", headers=headers).json()), 3)
        self.assertEqual(self.client.get("/api/posts/count", headers=headers).json(), {"count": 3})
        for post_id, status in ((2, "draft"), (3, "archived")):
            self.assertEqual(self.client.get("/api/posts", params={"status": status}, headers=headers).json()[0]["id"], post_id)
            self.assertEqual(self.client.get(f"/api/posts/detail/{post_id}", headers=headers).status_code, 200)
            self.assertEqual(self.client.get(f"/api/posts/{status}", headers=headers).status_code, 200)
            saved = self.client.put(f"/api/posts/{post_id}", json={"description": "owner edit"}, headers=headers)
            self.assertEqual(saved.status_code, 200)
            self.assertEqual(saved.json()["status"], status)

    def test_publishing_and_unpublishing_changes_public_access(self):
        self.assertEqual(self.client.put("/api/posts/2", json={"status": "published"}, headers=self.owner).status_code, 200)
        self.assertEqual(self.client.get("/api/posts/draft").status_code, 200)
        self.assertEqual(self.client.get("/api/posts/count").json(), {"count": 2})
        self.assertEqual(self.client.put("/api/posts/2", json={"status": "draft"}, headers=self.owner).status_code, 200)
        self.assertEqual(self.client.get("/api/posts/draft").status_code, 404)
        self.assertEqual(self.client.get("/api/posts/count").json(), {"count": 1})

    def test_public_taxonomy_counts_exclude_nonpublic_articles_without_rewriting_cache(self):
        for path in ("/api/categories", "/api/tags"):
            self.assertEqual(self.client.get(path).json()[0]["post_count"], 1)
            self.assertEqual(self.client.get(path, headers=self.owner).json()[0]["post_count"], 3)
        self.assertFalse(self.session.dirty)
        self.assertEqual(self.session.get(Category, 1).post_count, 3)
        self.assertEqual(self.session.get(Tag, 1).post_count, 3)

    def test_invalid_expired_and_nonowner_tokens_do_not_grant_owner_reads(self):
        expired = jwt.encode({"sub": "owner", "admin": True, "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}, SECRET_KEY, algorithm=ALGORITHM)
        for token, expected in (("invalid", 401), (expired, 401), (create_token({"sub": "visitor", "admin": False}), 403)):
            headers = {"Authorization": "Bearer " + token}
            for path in ("/api/posts", "/api/posts/count", "/api/posts/detail/2", "/api/posts/draft", "/api/categories", "/api/tags"):
                self.assertEqual(self.client.get(path, headers=headers).status_code, expected)


if __name__ == "__main__":
    unittest.main()
