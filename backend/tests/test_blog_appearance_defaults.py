import importlib.util
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.site_config import router
from app.database import get_session
from app.models.site_config import SiteConfig
from app.schemas.blog_appearance import PREFERENCE_KEYS
from app.utils.auth import get_current_user


spec = importlib.util.spec_from_file_location("export_site", Path(__file__).resolve().parents[1] / "scripts/export_site.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class BlogAppearanceDefaultsTests(unittest.TestCase):
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

    def test_effect_defaults_round_trip_and_reject_invalid_values(self):
        effects = {"clickEffect": False, "mouseTrail": True, "sparkleEffect": True, "fallingEffect": "constellation"}
        payload = {"preferences": {}, "theme": "system", "effects": effects}
        saved = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)
        for patch in [{"clickEffect": "false"}, {"fallingEffect": "unknown"}, {"unsupported": True}]:
            invalid = self.client.put("/api/site-config/appearance-defaults", json={**payload, "effects": {**effects, **patch}})
            self.assertEqual(invalid.status_code, 422)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)

    def test_public_defaults_without_row_do_not_write_database(self):
        response = self.client.get("/api/site-config/appearance-defaults")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"preferences": {}, "theme": "system"})
        self.assertEqual(self.session.query(SiteConfig).count(), 0)

    def test_background_defaults_are_validated_and_round_trip(self):
        payload = {"preferences": {}, "theme": "system", "background": {"image": "/uploads/background.webp", "blur": 12}}
        saved = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json(), payload)
        for background in [{"image": "javascript:alert(1)", "blur": 12}, {"image": "/images/bg.webp", "blur": 21}]:
            invalid = self.client.put("/api/site-config/appearance-defaults", json={**payload, "background": background})
            self.assertEqual(invalid.status_code, 422)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)

    def test_admin_save_round_trips_and_anonymous_write_is_denied(self):
        payload = {"preferences": {"hue": 210, "heroMediaUrl": "/uploads/look.webp"}, "theme": "dark"}
        saved = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json(), payload)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)
        self.client.app.dependency_overrides.pop(get_current_user)
        denied = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertIn(denied.status_code, (401, 403))
        self.assertEqual(self.session.query(SiteConfig).count(), 1)

    def test_full_preferences_payload_saves_and_round_trips(self):
        preferences = {key: "theme" for key in PREFERENCE_KEYS}
        preferences.update({
            "hue": 260, "themeHex": "#6750a4", "homeCardHex": "#ffffff",
            "textureOpacity": 12, "opacity": 96, "waveSpeed": 100, "waveOpacity": 25,
            "waveBackOpacity": 25, "waveAmplitude": 100, "waveLayers": 3,
            "homeTextScale": 100, "homeCardHue": 260, "articleTextScale": 100,
            "navigationTextScale": 100, "coverTitleScale": 100, "coverSubtitleScale": 100,
            "heroInterval": 4, "readingPageWidth": 1200, "readingContentWidth": 1000,
            "focusContentWidth": 1120, "themeColorSpread": False, "waves": True,
            "reduceMotion": False, "welcomeEnabled": True, "articleHoverGuide": True,
            "themeTransitionDuration": 650, "themeTransitionDirection": "top-left",
            "articleHoverFrame": True, "heroMediaUrl": "/videos/covers/evanescia.mp4",
            "heroSlides": ["/images/cover.webp"], "heroCustomMedia": [],
        })
        payload = {"preferences": preferences, "theme": "system"}
        self.assertGreater(len(preferences), 32)
        saved = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json(), payload)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)

    def test_theme_transition_defaults_round_trip_and_reject_bad_preferences(self):
        payload = {"preferences": {"themeTransitionDuration": 1200, "themeTransitionDirection": "top-right"}, "theme": "system"}
        saved = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)
        for patch in [{"themeTransitionDuration": 199}, {"themeTransitionDuration": 1601}, {"themeTransitionDuration": True}, {"themeTransitionDirection": "diagonal"}]:
            invalid = self.client.put("/api/site-config/appearance-defaults", json={**payload, "preferences": {**payload["preferences"], **patch}})
            self.assertEqual(invalid.status_code, 422, invalid.text)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)

    def test_rejects_unknown_object_urls_and_unsafe_nested_media(self):
        invalid = [
            {"preferences": {"madeUp": True}, "theme": "system"},
            {"preferences": {"live2dPosition": {"x": 0.5, "y": 0.5}}, "theme": "system"},
            {"preferences": {"heroMediaUrl": "//evil.example/a.webp"}, "theme": "system"},
            {"preferences": {"heroSlides": ["/uploads/%2e%2e/secret.png"]}, "theme": "system"},
            {"preferences": {"heroCustomMedia": [{"id": "x", "name": "x", "kind": "gif", "url": "data:image/gif;base64,abc"}]}, "theme": "system"},
            {"preferences": {}, "theme": "auto"},
        ]
        for payload in invalid:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.put("/api/site-config/appearance-defaults", json=payload).status_code, 422)
        self.assertEqual(self.session.query(SiteConfig).count(), 0)

    def test_cover_libraries_accept_50_and_reject_51_without_replacing_saved_data(self):
        preferences = {
            "heroSlides": [f"/images/cover-{index}.webp" for index in range(50)],
            "heroCustomMedia": [{"id": str(index), "name": f"Clip {index}", "kind": "video", "url": f"/videos/{index}.mp4"} for index in range(50)],
        }
        payload = {"preferences": preferences, "theme": "system"}
        saved = self.client.put("/api/site-config/appearance-defaults", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        for key, extra in [("heroSlides", "/images/extra.webp"), ("heroCustomMedia", {"id": "extra", "name": "Extra", "kind": "gif", "url": "/images/extra.gif"})]:
            invalid = {"preferences": {**preferences, key: [*preferences[key], extra]}, "theme": "system"}
            self.assertEqual(self.client.put("/api/site-config/appearance-defaults", json=invalid).status_code, 422)
        self.assertEqual(self.client.get("/api/site-config/appearance-defaults").json(), payload)

    def test_50_long_addresses_still_respect_total_size_guard(self):
        payload = {"preferences": {"heroSlides": ["https://example.com/" + "x" * 1200 + f"/{index}.webp" for index in range(50)]}, "theme": "system"}
        self.assertEqual(self.client.put("/api/site-config/appearance-defaults", json=payload).status_code, 422)
        self.assertEqual(self.session.query(SiteConfig).count(), 0)

    def test_generic_write_cannot_bypass_validation(self):
        encoded = json.dumps({"preferences": {"heroMediaUrl": "data:image/png;base64,abc"}, "theme": "light"})
        direct = self.client.put("/api/site-config/blogAppearanceDefaults", json={"value": encoded})
        batch = self.client.put("/api/site-config", json={"blogAppearanceDefaults": {"preferences": {"evil": 1}}})
        self.assertEqual(direct.status_code, 422)
        self.assertEqual(batch.status_code, 422)
        self.assertEqual(self.session.query(SiteConfig).count(), 0)

    def test_export_whitelists_defaults_validates_and_copies_nested_upload_refs(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            backend = temp / "backend"
            (backend / "uploads" / "look").mkdir(parents=True)
            (backend / "uploads" / "look" / "hero.webp").write_bytes(b"hero")
            database = temp / "source.db"
            config = {"preferences": {"heroMediaUrl": "/uploads/look/hero.webp", "heroSlides": ["/uploads/look/hero.webp"]}, "theme": "light"}
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE site_config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)")
                db.executemany("INSERT INTO site_config VALUES (?, ?, ?)", [
                    (1, "blogAppearanceDefaults", json.dumps(config)),
                    (2, "secret", "never-export"),
                ])
                db.commit()
            output = temp / "publication"
            with patch.object(exporter, "BACKEND", backend), patch.object(exporter, "ROOT", temp), patch.object(
                exporter, "configured_database", return_value="sqlite:///" + database.as_posix()
            ):
                exporter.export(output)
            payload = json.loads((output / "public/content/index.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["siteConfig"]["blogAppearanceDefaults"], config)
            self.assertNotIn("secret", payload["siteConfig"])
            self.assertEqual((output / "public/uploads/look/hero.webp").read_bytes(), b"hero")

    def test_export_rejects_invalid_persisted_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            database = temp / "source.db"
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE site_config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)")
                db.execute("INSERT INTO site_config VALUES (1, 'blogAppearanceDefaults', ?)",
                           (json.dumps({"preferences": {"heroMediaUrl": "//evil.example/a.png"}, "theme": "system"}),))
                db.commit()
            with patch.object(exporter, "BACKEND", temp / "backend"), patch.object(exporter, "ROOT", temp), patch.object(
                exporter, "configured_database", return_value="sqlite:///" + database.as_posix()
            ):
                with self.assertRaisesRegex(ValueError, "Invalid blogAppearanceDefaults"):
                    exporter.export(temp / "publication")


if __name__ == "__main__":
    unittest.main()
