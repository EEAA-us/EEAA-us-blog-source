import os
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine
from sqlalchemy.pool import StaticPool

from app.database import get_session
from app.models import Post
from app.api.ai import router
from app.services import ai_service


class ClientAddressOverride:
    def __init__(self, app, host):
        self.app = app
        self.host = host

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            scope = dict(scope)
            scope["client"] = (self.host, 43120)
        await self.app(scope, receive, send)


class AIAPITests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Post.__table__.create(self.engine)
        self.session = Session(self.engine)
        self.post = Post(
            title="Local draft", slug="local-draft", description="Draft summary", content="Draft body",
            status="draft", views=9, updated_at=datetime(2026, 5, 6, 7, 8, 9),
        )
        self.session.add(self.post)
        self.session.commit()
        self.session.refresh(self.post)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.revision_path = Path(self.temp_dir.name) / "revisions.sqlite3"
        self.original_revision_path = ai_service.REVISION_DB_PATH
        ai_service.REVISION_DB_PATH = self.revision_path

        app = FastAPI()
        app.include_router(router)

        def test_session():
            yield self.session

        app.dependency_overrides[get_session] = test_session
        self.client = TestClient(
            ClientAddressOverride(app, "127.0.0.1"),
            base_url="http://localhost",
            headers={"Host": "localhost"},
        )
        self.read_token = "r" * 40
        self.draft_token = "d" * 40
        self.env_patch = patch.dict(os.environ, {
            "BLOG_AI_READ_TOKEN": self.read_token,
            "BLOG_AI_DRAFT_TOKEN": self.draft_token,
        })
        self.env_patch.start()

    def tearDown(self):
        self.env_patch.stop()
        ai_service.REVISION_DB_PATH = self.original_revision_path
        self.client.close()
        self.session.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_local_loopback_and_host_are_both_required(self):
        wrong_host = self.client.get(
            "/api/ai/posts",
            headers={"Host": "localhost.attacker.example", "Authorization": f"Bearer {self.read_token}"},
        )
        self.assertEqual(wrong_host.status_code, 403)

        remote = TestClient(
            ClientAddressOverride(self.client.app.app, "192.0.2.10"),
            base_url="http://localhost",
            headers={"Host": "localhost"},
        )
        try:
            denied = remote.get("/api/ai/posts", headers={"Authorization": f"Bearer {self.read_token}"})
        finally:
            remote.close()
        self.assertEqual(denied.status_code, 403)

    def test_read_and_draft_tokens_must_be_long_and_distinct(self):
        with patch.dict(os.environ, {"BLOG_AI_READ_TOKEN": "same-token-value-that-is-long-enough-000", "BLOG_AI_DRAFT_TOKEN": "same-token-value-that-is-long-enough-000"}):
            same = self.client.get("/api/ai/posts", headers={"Authorization": "Bearer same-token-value-that-is-long-enough-000"})
        self.assertEqual(same.status_code, 503)

        with patch.dict(os.environ, {"BLOG_AI_READ_TOKEN": "short", "BLOG_AI_DRAFT_TOKEN": self.draft_token}):
            short = self.client.get("/api/ai/posts", headers={"Authorization": "Bearer short"})
        self.assertEqual(short.status_code, 503)

    def test_scopes_cache_headers_and_non_mutating_read(self):
        missing = self.client.get("/api/ai/posts")
        self.assertEqual(missing.status_code, 401)

        listed = self.client.get("/api/ai/posts?status=draft", headers={"Authorization": f"Bearer {self.read_token}"})
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["total"], 1)
        self.assertEqual(listed.headers["cache-control"], "no-store, max-age=0")

        detail = self.client.get(f"/api/ai/posts/{self.post.id}", headers={"Authorization": f"Bearer {self.read_token}"})
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["views"], 9)

        forbidden = self.client.patch(
            f"/api/ai/drafts/{self.post.id}",
            headers={"Authorization": f"Bearer {self.read_token}"},
            json={"expected_updated_at": self.post.updated_at.isoformat(), "title": "Should fail"},
        )
        self.assertEqual(forbidden.status_code, 401)

    def test_patch_requires_version_and_rejects_status_changes(self):
        url = f"/api/ai/drafts/{self.post.id}"
        headers = {"Authorization": f"Bearer {self.draft_token}"}
        missing_version = self.client.patch(url, headers=headers, json={"title": "No version"})
        self.assertEqual(missing_version.status_code, 422)

        forbidden_field = self.client.patch(
            url,
            headers=headers,
            json={"expected_updated_at": self.post.updated_at.isoformat(), "title": "Publish?", "status": "published"},
        )
        self.assertEqual(forbidden_field.status_code, 422)
        self.assertEqual(ai_service.read_post(self.session, self.post.id)["title"], "Local draft")

    def test_conditional_patch_conflict_and_explicit_restore(self):
        url = f"/api/ai/drafts/{self.post.id}"
        headers = {"Authorization": f"Bearer {self.draft_token}"}
        original_timestamp = self.post.updated_at.isoformat()
        changed = self.client.patch(url, headers=headers, json={
            "expected_updated_at": original_timestamp,
            "title": "Updated draft",
        })
        self.assertEqual(changed.status_code, 200)
        payload = changed.json()
        self.assertEqual(payload["title"], "Updated draft")

        stale = self.client.patch(url, headers=headers, json={
            "expected_updated_at": original_timestamp,
            "title": "Stale overwrite",
        })
        self.assertEqual(stale.status_code, 409)

        restored = self.client.patch(
            f"/api/ai/drafts/{self.post.id}/restore/{payload['revision_id']}",
            headers=headers,
            json={"expected_updated_at": payload["updated_at"]},
        )
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()["title"], "Local draft")

    def test_stats_reject_invalid_date_and_do_not_cache(self):
        headers = {"Authorization": f"Bearer {self.read_token}"}
        invalid = self.client.get("/api/ai/stats?start=2026-02-30&end=2026-03-01", headers=headers)
        self.assertEqual(invalid.status_code, 422)

        worker_payload = {
            "timezone": "Asia/Shanghai",
            "dateBoundary": "event date in Asia/Shanghai, inclusive start and end",
            "source": "synthetic test payload",
            "queriedAt": "2026-10-02T03:04:05Z",
            "range": {"start": "2026-10-01", "end": "2026-10-02"},
            "totals": {"pv": 0, "sessions": 0, "uv": 0},
            "daily": [],
            "ranking": [],
        }
        with patch.object(ai_service, "get_statistics", return_value=worker_payload):
            result = self.client.get("/api/ai/stats?start=2026-10-01&end=2026-10-02", headers=headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["source"], "synthetic test payload")
        self.assertEqual(result.headers["cache-control"], "no-store, max-age=0")


if __name__ == "__main__":
    unittest.main()
