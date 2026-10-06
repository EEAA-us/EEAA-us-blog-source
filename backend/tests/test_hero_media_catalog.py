import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.site_config import router
from app.database import get_session
from app.models.site_config import SiteConfig
from app.services import hero_media_catalog_service
from app.utils.auth import get_current_user


def catalog(url="/uploads/hero.mp4"):
    return {
        "version": 1,
        "categories": [{"id": "anime", "name": "Anime", "order": 0, "enabled": True}],
        "items": [{"id": "clip", "name": "Clip", "category": "anime", "kind": "video", "url": url,
                   "poster": "/uploads/poster.jpg", "order": 0, "enabled": True}],
    }


class HeroMediaCatalogTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        app = FastAPI()
        app.include_router(router)

        def test_session():
            yield self.session

        app.dependency_overrides[get_session] = test_session
        app.dependency_overrides[get_current_user] = lambda: {"sub": "admin"}
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.session.close()
        self.engine.dispose()

    def test_catalog_routes_are_distinct_from_generic_key_routes(self):
        with patch.object(hero_media_catalog_service, "DEFAULTS_PATH", Path("missing-defaults.json")):
            first = self.client.get("/api/site-config/media-catalog")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json(), {"version": 1, "categories": [], "items": []})
        self.assertEqual(self.session.query(SiteConfig).count(), 0)
        saved = self.client.put("/api/site-config/media-catalog", json=catalog())
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(self.client.get("/api/site-config/media-catalog").json(), catalog())
        self.assertEqual(self.session.query(SiteConfig).count(), 1)

    def test_anonymous_write_is_denied(self):
        self.client.app.dependency_overrides.pop(get_current_user)
        response = self.client.put("/api/site-config/media-catalog", json=catalog())
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(self.session.query(SiteConfig).count(), 0)

    def test_rejects_unsafe_urls_relations_and_duplicate_ids(self):
        for bad_url in ("javascript:alert(1)", "//evil.test/a.gif", "http://example.test/a.mp4", "/uploads/a.gif"):
            with self.subTest(url=bad_url):
                response = self.client.put("/api/site-config/media-catalog", json=catalog(bad_url))
                self.assertEqual(response.status_code, 422)
        invalid = catalog()
        invalid["items"][0]["category"] = "missing"
        self.assertEqual(self.client.put("/api/site-config/media-catalog", json=invalid).status_code, 422)
        duplicate = catalog()
        duplicate["categories"].append(dict(duplicate["categories"][0]))
        self.assertEqual(self.client.put("/api/site-config/media-catalog", json=duplicate).status_code, 422)

    def test_empty_catalog_is_persisted_and_does_not_fall_back(self):
        defaults = {"version": 1, "categories": [{"id": "old", "name": "Old", "order": 0, "enabled": True}], "items": []}
        with tempfile.TemporaryDirectory() as directory:
            defaults_path = Path(directory) / "defaults.json"
            defaults_path.write_text(json.dumps(defaults), encoding="utf-8")
            with patch.object(hero_media_catalog_service, "DEFAULTS_PATH", defaults_path):
                self.assertEqual(self.client.get("/api/site-config/media-catalog").json(), defaults)
                self.assertEqual(self.session.query(SiteConfig).count(), 0)
                empty = {"version": 1, "categories": [], "items": []}
                self.assertEqual(self.client.put("/api/site-config/media-catalog", json=empty).json(), empty)
                self.assertEqual(self.client.get("/api/site-config/media-catalog").json(), empty)

    def test_generic_config_writes_cannot_bypass_validation(self):
        response = self.client.put("/api/site-config/heroMediaCatalog", json={"value": json.dumps(catalog("javascript:alert(1)"))})
        self.assertEqual(response.status_code, 422)
        batch = self.client.put("/api/site-config", json={"heroMediaCatalog": {"version": 1, "categories": [], "items": [{"url": "//bad/x.gif"}]}})
        self.assertEqual(batch.status_code, 422)
        self.assertEqual(self.session.query(SiteConfig).count(), 0)


if __name__ == "__main__":
    unittest.main()
