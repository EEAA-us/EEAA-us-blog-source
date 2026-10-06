import sqlite3
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from app.models import Post
from app.services import ai_service


class AIServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Post.__table__.create(self.engine)
        self.session = Session(self.engine)
        self.post = Post(
            title="Original draft",
            slug="original-draft",
            description="Before edit",
            content="Original body",
            status="draft",
            views=17,
            updated_at=datetime(2026, 1, 2, 3, 4, 5),
        )
        self.session.add(self.post)
        self.session.commit()
        self.session.refresh(self.post)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.revision_path = Path(self.temp_dir.name) / "revisions.sqlite3"
        self.original_revision_path = ai_service.REVISION_DB_PATH
        ai_service.REVISION_DB_PATH = self.revision_path

    def tearDown(self):
        ai_service.REVISION_DB_PATH = self.original_revision_path
        self.session.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_read_is_non_mutating_and_search_lists_drafts(self):
        published = Post(title="Published", slug="published", status="published", views=8)
        self.session.add(published)
        self.session.commit()

        detail = ai_service.read_post(self.session, self.post.id)
        result = ai_service.search_drafts(self.session, "Original", page=1, size=10)

        self.assertEqual(detail["views"], 17)
        self.assertEqual([item["title"] for item in result["items"]], ["Original draft"])
        self.assertEqual(result["total"], 1)

    def test_update_saves_previous_revision_and_restore_is_explicit(self):
        original_updated_at = self.post.updated_at
        changed = ai_service.update_draft(
            self.session,
            self.post.id,
            original_updated_at,
            {"title": "Edited draft", "content": "Edited body"},
        )
        self.assertEqual(changed["title"], "Edited draft")
        self.assertNotEqual(changed["updated_at"], original_updated_at)
        self.assertEqual(changed["revision_id"], 1)
        self.assertEqual(self.session.get(Post, self.post.id).word_count, len("Edited body"))

        revision = ai_service.get_revision(self.post.id, changed["revision_id"])
        self.assertEqual(revision["title"], "Original draft")
        self.assertEqual(revision["content"], "Original body")

        restored = ai_service.restore_draft_revision(
            self.session,
            self.post.id,
            changed["revision_id"],
            changed["updated_at"],
        )
        self.assertEqual(restored["title"], "Original draft")
        self.assertEqual(restored["content"], "Original body")
        self.assertEqual(restored["restored_revision_id"], changed["revision_id"])

    def test_stale_version_conflicts_without_overwriting_latest(self):
        original_updated_at = self.post.updated_at
        changed = ai_service.update_draft(
            self.session,
            self.post.id,
            original_updated_at,
            {"title": "First edit"},
        )
        with self.assertRaises(HTTPException) as conflict:
            ai_service.update_draft(
                self.session,
                self.post.id,
                original_updated_at,
                {"title": "Stale edit"},
            )

        self.assertEqual(conflict.exception.status_code, 409)
        self.assertEqual(ai_service.read_post(self.session, self.post.id)["title"], "First edit")
        connection = sqlite3.connect(self.revision_path)
        try:
            revisions = connection.execute("SELECT COUNT(*) FROM draft_revisions").fetchone()[0]
        finally:
            connection.close()
        self.assertEqual(revisions, 1)
        self.assertNotEqual(changed["updated_at"], original_updated_at)

    def test_published_posts_cannot_be_edited(self):
        published = Post(title="Published", slug="published", status="published")
        self.session.add(published)
        self.session.commit()
        self.session.refresh(published)

        with self.assertRaises(HTTPException) as conflict:
            ai_service.update_draft(self.session, published.id, published.updated_at, {"title": "No"})

        self.assertEqual(conflict.exception.status_code, 409)
        self.assertFalse(self.revision_path.exists())

    def test_revision_failure_leaves_original_unchanged(self):
        self.revision_path.mkdir()
        with self.assertRaises(HTTPException) as unavailable:
            ai_service.update_draft(
                self.session,
                self.post.id,
                self.post.updated_at,
                {"title": "Must not be saved"},
            )

        self.assertEqual(unavailable.exception.status_code, 503)
        self.assertEqual(ai_service.read_post(self.session, self.post.id)["title"], "Original draft")

    def test_statistics_proxy_preserves_worker_data_and_uses_admin_bearer(self):
        requested = []
        worker = {
            "timezone": "Asia/Shanghai",
            "dateBoundary": "event date in Asia/Shanghai, inclusive start and end",
            "source": "D1 visitor_events and posts",
            "queriedAt": "2026-10-02T03:04:05Z",
            "range": {"start": "2026-10-01", "end": "2026-10-02"},
            "totals": {"pv": 3, "sessions": 2, "uv": 2},
            "daily": [],
            "ranking": [],
        }

        def handler(request):
            requested.append(request)
            return httpx.Response(200, json=worker, request=request)

        real_client = httpx.Client
        with patch.dict(os_environ(), {"BLOG_STATS_URL": "https://stats.example", "BLOG_STATS_ADMIN_TOKEN": "s" * 40}):
            with patch.object(ai_service.httpx, "Client", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)):
                result = ai_service.get_statistics(datetime(2026, 10, 1).date(), datetime(2026, 10, 2).date())

        self.assertEqual(result, worker)
        self.assertEqual(requested[0].url.path, "/admin/summary")
        self.assertEqual(requested[0].url.params["end"], "2026-10-02")
        self.assertEqual(requested[0].headers["authorization"], "Bearer " + "s" * 40)

    def test_statistics_uses_owner_proxy_only_for_cloud_https(self):
        for url, expected_proxy in [("https://stats.example", True), ("http://127.0.0.1:8787", False)]:
            with self.subTest(url=url), patch.dict(os_environ(), {"BLOG_STATS_URL": url, "BLOG_STATS_ADMIN_TOKEN": "s" * 40}):
                with patch.object(ai_service.httpx, "Client", side_effect=httpx.ConnectError("offline")) as client:
                    with self.assertRaises(HTTPException) as unavailable:
                        ai_service.get_statistics(datetime(2026, 10, 1).date(), datetime(2026, 10, 2).date())
                    self.assertEqual(unavailable.exception.status_code, 503)
                    self.assertEqual(client.call_args.kwargs["trust_env"], expected_proxy)
                    self.assertFalse(client.call_args.kwargs["follow_redirects"])

    def test_statistics_upstream_failure_is_503(self):
        real_client = httpx.Client
        with patch.dict(os_environ(), {"BLOG_STATS_URL": "https://stats.example", "BLOG_STATS_ADMIN_TOKEN": "s" * 40}):
            with patch.object(ai_service.httpx, "Client", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(lambda request: httpx.Response(401, request=request)), **kwargs)):
                with self.assertRaises(HTTPException) as unavailable:
                    ai_service.get_statistics(datetime(2026, 10, 1).date(), datetime(2026, 10, 2).date())
        self.assertEqual(unavailable.exception.status_code, 503)


def os_environ():
    import os

    return os.environ


if __name__ == "__main__":
    unittest.main()
