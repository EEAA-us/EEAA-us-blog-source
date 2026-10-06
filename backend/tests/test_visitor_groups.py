import unittest
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.visitors import router
from app.deps import get_session
from app.models.visitor import Visitor
from app.services.visitor_service import get_ip_groups, get_ip_visits


class VisitorGroupTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        app = FastAPI()
        app.include_router(router)

        def test_session():
            yield self.session

        app.dependency_overrides[get_session] = test_session
        self.client = TestClient(app)
        now = datetime(2026, 10, 4, 15, 30)
        for ip, path, minutes_ago in [
            ("127.0.0.1", "/", 10),
            ("127.0.0.1", "/about", 2),
            ("::1", "/posts", 5),
            ("203.0.113.8", "/", 1),
        ]:
            self.session.add(Visitor(ip=ip, path=path, created_at=now - timedelta(minutes=minutes_ago)))
        self.session.commit()

    def tearDown(self):
        self.client.close()
        self.session.close()
        self.engine.dispose()

    def test_ip_groups_count_and_order_by_latest(self):
        result = get_ip_groups(self.session, limit=2)
        self.assertEqual(result["total"], 3)
        self.assertEqual(result["items"][0]["ip"], "203.0.113.8")
        self.assertEqual(next(item["visit_count"] for item in result["items"] if item["ip"] == "127.0.0.1"), 2)

    def test_search_and_group_window_are_bounded(self):
        result = get_ip_groups(self.session, search="127.0", offset=0, limit=1)
        self.assertEqual(result["total"], 1)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["ip"], "127.0.0.1")

    def test_paths_are_recent_and_windowed(self):
        result = get_ip_visits(self.session, "127.0.0.1", offset=0, limit=1)
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["items"][0]["path"], "/about")
        self.assertEqual(len(result["items"]), 1)
        next_page = get_ip_visits(self.session, "127.0.0.1", offset=1, limit=1)
        self.assertEqual(next_page["items"][0]["path"], "/")

    def test_ip_group_and_path_endpoints_require_login(self):
        for url in ("/api/visitors/groups", "/api/visitors/group-visits?ip=127.0.0.1"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
