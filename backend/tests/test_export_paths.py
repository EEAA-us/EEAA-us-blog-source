import importlib.util
import json
import sqlite3
import tempfile
import unittest
import hashlib
from PIL import Image
from pathlib import Path
from unittest.mock import patch
from contextlib import closing

spec = importlib.util.spec_from_file_location("export_site", Path(__file__).resolve().parents[1] / "scripts/export_site.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportReferenceTests(unittest.TestCase):
    def test_article_image_headers_reserve_local_layout_without_changing_originals(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "public/images").mkdir(parents=True)
            image_path = output / "public/images/chart.png"
            Image.new("RGB", (1200, 800)).save(image_path)
            original_hash = hashlib.sha256(image_path.read_bytes()).hexdigest()
            (output / "public/images/vector.svg").write_text('<svg viewBox="0 0 640 360"></svg>', encoding="utf-8")
            (output / "public/images/invalid.png").write_bytes(b"not an image")
            dimensions = exporter.article_image_dimensions(
                '![chart](/images/chart.png)\n![svg](/images/vector.svg)\n'
                '![bad](/images/invalid.png)\n![remote](https://example.com/x.png)\n'
                '![outside](/../private.png)\n![protocol](//example.com/image.png)', output)
            self.assertEqual(dimensions, {
                "/images/chart.png": {"width": 1200, "height": 800},
                "/images/vector.svg": {"width": 640, "height": 360},
            })
            self.assertEqual(hashlib.sha256(image_path.read_bytes()).hexdigest(), original_hash)

    def test_export_includes_optional_dimensions_only_in_published_article_details(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            database = temp / "source.db"
            content = "![chart](/chart.png)"
            (temp / "public").mkdir()
            Image.new("RGB", (800, 600)).save(temp / "public/chart.png")
            output = temp / "publication"
            (output / "public").mkdir(parents=True)
            Image.new("RGB", (800, 600)).save(output / "public/chart.png")
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE post (id INTEGER, title TEXT, slug TEXT, description TEXT, cover TEXT, category_id INTEGER, status TEXT, is_pinned INTEGER, views INTEGER, likes INTEGER, word_count INTEGER, reading_time INTEGER, published_at TEXT, created_at TEXT, updated_at TEXT, content TEXT)")
                db.execute("INSERT INTO post VALUES (1, 'Chart', 'chart', '', '', NULL, 'published', 0, 0, 0, 1, 1, NULL, '', '', ?)", (content,))
                db.commit()
            original_hash = hashlib.sha256(database.read_bytes()).hexdigest()
            with patch.object(exporter, "ROOT", temp), patch.object(exporter, "configured_database", return_value="sqlite:///" + database.as_posix()):
                exporter.export(output)
            detail = json.loads((output / "public/content/posts/1.json").read_text(encoding="utf-8"))
            index = json.loads((output / "public/content/index.json").read_text(encoding="utf-8"))
            self.assertEqual(detail["image_dimensions"], {"/chart.png": {"width": 800, "height": 600}})
            self.assertEqual(detail["content"], content)
            self.assertNotIn("image_dimensions", index["posts"][0])
            self.assertEqual(hashlib.sha256(database.read_bytes()).hexdigest(), original_hash)

    def test_public_music_configuration_preserves_consumer_strings(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "source.db"
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE site_config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)")
                db.executemany("INSERT INTO site_config VALUES (?, ?, ?)", [
                    (1, "cloud_music_playlist_id", "17943739323"),
                    (2, "cloud_music_ids", '["5235487", "101820"]'),
                    (3, "private_token", "must-not-be-published"),
                ])
                db.commit()
            before = database.read_bytes()
            output = Path(directory) / "publication"
            with patch.object(exporter, "configured_database", return_value="sqlite:///" + database.as_posix()):
                exporter.export(output)
            config = json.loads((output / "public/content/index.json").read_text(encoding="utf-8"))["siteConfig"]
            self.assertEqual(config["cloud_music_playlist_id"], "17943739323")
            self.assertEqual(config["cloud_music_ids"], '["5235487", "101820"]')
            self.assertNotIn("private_token", config)
            self.assertEqual(database.read_bytes(), before)

    def test_sqlite_relative_database_is_relative_to_backend(self):
        self.assertEqual(exporter.database_path("sqlite:///./kirameku.db"), exporter.BACKEND / "kirameku.db")

    def test_remote_urls_are_not_mistaken_for_local_assets(self):
        self.assertEqual(exporter.config_local_references({"url": "https://example.test/", "cover": "https://cdn.example.test/image.jpg"}), set())
        self.assertEqual(exporter.config_local_references({"images": ["/uploads/a.png", "//cdn.example.test/a.png"]}), {"/uploads/a.png"})

    def test_article_references_keep_local_uploads_and_skip_remote_images(self):
        self.assertEqual(exporter.embedded_local_references('![local](/uploads/a.png) ![remote](https://cdn.example.test/a.png) <img src="/images/x.webp">'), {"/uploads/a.png", "/images/x.webp"})

    def test_catalog_is_exported_and_referenced_uploads_are_copied(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            backend = temp / "backend"
            uploads = backend / "uploads"
            (uploads / "hero").mkdir(parents=True)
            (uploads / "hero" / "clip.mp4").write_bytes(b"video")
            (uploads / "hero" / "poster.jpg").write_bytes(b"poster")
            database = temp / "source.db"
            catalog = {
                "version": 1,
                "categories": [{"id": "anime", "name": "Anime", "order": 0, "enabled": True}],
                "items": [{"id": "clip", "name": "Clip", "category": "anime", "kind": "video",
                           "url": "/uploads/hero/clip.mp4", "poster": "/uploads/hero/poster.jpg",
                           "order": 0, "enabled": True}],
            }
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE site_config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)")
                db.execute("INSERT INTO site_config VALUES (?, ?, ?)", (1, "heroMediaCatalog", json.dumps(catalog)))
                db.commit()
            output = temp / "publication"
            with patch.object(exporter, "BACKEND", backend), patch.object(exporter, "ROOT", temp), patch.object(
                exporter, "configured_database", return_value="sqlite:///" + database.as_posix()
            ):
                exporter.export(output)
            payload = json.loads((output / "public/content/index.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["siteConfig"]["heroMediaCatalog"], catalog)
            self.assertEqual((output / "public/uploads/hero/clip.mp4").read_bytes(), b"video")
            self.assertEqual((output / "public/uploads/hero/poster.jpg").read_bytes(), b"poster")

    def test_project_covers_are_exported_and_referenced_uploads_are_copied(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            backend = temp / "backend"
            (backend / "uploads" / "projects").mkdir(parents=True)
            (backend / "uploads" / "projects" / "cover.webp").write_bytes(b"cover")
            database = temp / "source.db"
            covers = {"covers": {"stm32-learning": "/uploads/projects/cover.webp"}}
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE site_config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)")
                db.execute("INSERT INTO site_config VALUES (?, ?, ?)", (1, "projectCovers", json.dumps(covers)))
                db.commit()
            output = temp / "publication"
            with patch.object(exporter, "BACKEND", backend), patch.object(exporter, "ROOT", temp), patch.object(
                exporter, "configured_database", return_value="sqlite:///" + database.as_posix()
            ):
                exporter.export(output)
            payload = json.loads((output / "public/content/index.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["siteConfig"]["projectCovers"], covers)
            self.assertEqual((output / "public/uploads/projects/cover.webp").read_bytes(), b"cover")
