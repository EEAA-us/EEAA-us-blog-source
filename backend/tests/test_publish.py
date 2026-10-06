import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from starlette.requests import Request

from app.api.publish import local_admin
from app.services import publish_service


REQUIRED = {
    "NEXT_PUBLIC_SITE_URL": "https://blog.example.test",
    "VERCEL_TOKEN": "vercel-test-token",
    "VERCEL_PROJECT_ID": "project-test-id",
    "VERCEL_ORG_ID": "org-test-id",
    "VERCEL_AUTOMATION_BYPASS_SECRET": "preview-test-secret",
    "BLOG_PUBLISH_GIT_URL": "https://github.com/example/blog-site.git",
    "GITHUB_TOKEN": "github-test-token",
    "BLOG_STATS_URL": "https://stats.example.test",
    "BLOG_STATS_ADMIN_TOKEN": "admin-test-secret",
    "BLOG_STATS_SERVICE_TOKEN": "service-test-secret",
}


class FakeSession:
    def __init__(self, user):
        self.user = user

    def exec(self, _statement):
        return SimpleNamespace(first=lambda: self.user)


def request(host="127.0.0.1", url_host="localhost", origin=None):
    headers = [(b"host", url_host.encode())]
    if origin:
        headers.append((b"origin", origin.encode()))
    return Request({
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "GET", "scheme": "http", "path": "/api/publish/status",
        "raw_path": b"/api/publish/status", "query_string": b"", "root_path": "",
        "headers": headers, "client": (host, 45678), "server": (url_host, 8000),
    })


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state_file = Path(self.temp.name) / "state.json"
        self.state_patch = patch.object(publish_service, "STATE_FILE", self.state_file)
        self.state_patch.start()

    def tearDown(self):
        if publish_service._lock.locked():
            publish_service._lock.release()
        self.state_patch.stop()
        self.temp.cleanup()

    def test_local_admin_requires_loopback_local_host_and_admin(self):
        admin = SimpleNamespace(username="owner", is_admin=True)
        result = local_admin(request(origin="http://localhost:3000"), {"sub": "owner"}, FakeSession(admin))
        self.assertIs(result, admin)

        cases = [
            (request(host="198.51.100.8"), admin, "remote client"),
            (request(url_host="blog.example.test"), admin, "non-local host"),
            (request(origin="https://evil.example.test"), admin, "remote origin"),
            (request(), SimpleNamespace(username="reader", is_admin=False), "non-admin"),
        ]
        for req, user, label in cases:
            with self.subTest(label=label), self.assertRaises(Exception) as raised:
                local_admin(req, {"sub": user.username}, FakeSession(user))
            self.assertEqual(getattr(raised.exception, "status_code", None), 403)

    def test_missing_credentials_do_not_start_a_publication_thread(self):
        with patch.dict(os.environ, {key: "" for key in REQUIRED}):
            state = publish_service.status()
            self.assertFalse(state["ready"])
            self.assertEqual(set(state["missingConfig"]), set(REQUIRED))
            with patch.object(publish_service.threading, "Thread") as thread:
                with self.assertRaises(ValueError):
                    publish_service.start()
                thread.assert_not_called()
        self.assertFalse(self.state_file.exists())

    def test_start_serializes_jobs_and_saves_json_state(self):
        class DormantThread:
            def __init__(self, *args, **kwargs):
                self.args = args
                self.kwargs = kwargs
            def start(self):
                pass

        with patch.dict(os.environ, REQUIRED), patch.object(publish_service.threading, "Thread", DormantThread):
            first = publish_service.start()
            self.assertEqual(first["phase"], "running")
            self.assertTrue(publish_service._lock.locked())
            with self.assertRaises(RuntimeError):
                publish_service.start()

        saved = json.loads(self.state_file.read_text(encoding="utf-8"))
        self.assertEqual(saved["jobId"], first["jobId"])
        self.assertIs(saved["published"], False)
        self.assertEqual(saved["phase"], "running")

    def test_failed_publish_keeps_last_url_and_redacts_secret(self):
        previous_url = "https://old-production.vercel.app"
        secret = "failure-output-secret-123"
        state = {"jobId": "job-1", "phase": "running", "published": False, "lastSuccessfulUrl": previous_url}
        with patch.dict(os.environ, {**REQUIRED, "VERCEL_TOKEN": secret}), \
             patch.object(publish_service.shutil, "which", return_value="node"), \
             patch.object(publish_service.subprocess, "run", side_effect=__import__("subprocess").CalledProcessError(1, "node", stderr=f"failed with {secret}")):
            self.assertTrue(publish_service._lock.acquire(blocking=False))
            publish_service._execute(state)

        saved = json.loads(self.state_file.read_text(encoding="utf-8"))
        self.assertEqual(saved["phase"], "failed")
        self.assertEqual(saved["lastSuccessfulUrl"], previous_url)
        self.assertNotIn(secret, saved["message"])
        self.assertIn("[redacted]", saved["message"])


if __name__ == "__main__":
    unittest.main()
