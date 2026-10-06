import json
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.site_config import router
from app.database import get_session
from app.models.site_config import SiteConfig
from app.utils.auth import get_current_user


class ProjectCoverTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_session] = lambda: self.session
        app.dependency_overrides[get_current_user] = lambda: {"sub": "admin"}
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.session.close()
        self.engine.dispose()

    def test_read_save_and_local_upload_reference(self):
        self.assertEqual(self.client.get("/api/site-config/project-covers").json(), {"covers": {}})
        config = {"covers": {"stm32-learning": "/uploads/project.webp", "blog": "/images/anime-stills/bocchi.webp"}}
        saved = self.client.put("/api/site-config/project-covers", json=config)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json(), config)
        row = self.session.query(SiteConfig).one()
        self.assertEqual(json.loads(row.value), config)
        self.assertEqual(self.client.get("/api/site-config/project-covers").json(), config)

    def test_rejects_invalid_urls_and_bounds(self):
        for url in ("http://example.test/a.png", "//evil.test/a", "javascript:alert(1)", "/uploads/../secret.png", "/uploads/%2e%2e/secret.png", "/uploads/%2E%2E%2Fsecret.png", "/uploads/a%5C..%5Csecret.png", "/other/a.png"):
            with self.subTest(url=url):
                response = self.client.put("/api/site-config/project-covers", json={"covers": {"blog": url}})
                self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.put("/api/site-config/project-covers", json={"covers": {"bad id": "/images/a.png"}}).status_code, 422)
        too_many = {f"project-{index}": "/images/a.png" for index in range(21)}
        self.assertEqual(self.client.put("/api/site-config/project-covers", json={"covers": too_many}).status_code, 422)

    def test_auth_and_generic_config_validation(self):
        self.client.app.dependency_overrides.pop(get_current_user)
        self.assertIn(self.client.put("/api/site-config/project-covers", json={"covers": {}}).status_code, (401, 403))
        self.client.app.dependency_overrides[get_current_user] = lambda: {"sub": "admin"}
        response = self.client.put("/api/site-config/projectCovers", json={"value": json.dumps({"covers": {"blog": "javascript:bad"}})})
        self.assertEqual(response.status_code, 422)
        response = self.client.put("/api/site-config", json={"projectCovers": {"blog": "//evil.test/x"}})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.session.query(SiteConfig).count(), 0)


if __name__ == "__main__":
    unittest.main()
