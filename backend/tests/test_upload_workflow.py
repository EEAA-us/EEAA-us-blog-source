import os
import tempfile
import unittest
import asyncio
import threading
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.api import upload
from app.deps import get_current_user
from starlette.datastructures import UploadFile, Headers


class UploadWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.app = FastAPI()
        self.app.include_router(upload.router)
        self.app.dependency_overrides[get_current_user] = lambda: {"sub": "admin", "admin": True}
        self.client = TestClient(self.app)
        self.environment = patch.dict(os.environ, {"BLOG_UPLOAD_STORAGE": "local"})
        self.environment.start()
        self.file_patch = patch.object(upload, "__file__", str(self.root / "app" / "api" / "upload.py"))
        self.file_patch.start()

    def tearDown(self):
        self.client.close()
        self.file_patch.stop()
        self.environment.stop()
        self.temp.cleanup()

    def test_valid_image_preserves_bytes_orientation_and_generated_name(self):
        stream = BytesIO()
        Image.new("RGB", (10, 20)).save(stream, format="PNG")
        data = stream.getvalue()
        response = self.client.post("/api/upload/image", files={"file": ("../../outside.png", data, "image/png")})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["orientation"], "portrait")
        saved = self.root / result["url"].lstrip("/")
        self.assertEqual(saved.parent, self.root / "uploads")
        self.assertEqual(saved.read_bytes(), data)

    def test_invalid_type_corrupt_image_svg_and_size_are_rejected(self):
        for mime, data in (("text/plain", b"text"), ("image/png", b"not a picture"), ("image/svg+xml", b"<svg/>")):
            self.assertEqual(self.client.post("/api/upload/image", files={"file": ("test", data, mime)}).status_code, 400)
        with patch.object(upload, "MAX_SIZE", 4):
            self.assertEqual(self.client.post("/api/upload/image", files={"file": ("test", b"12345", "image/png")}).status_code, 400)
        self.assertFalse((self.root / "uploads").exists())

    def test_upload_requires_authentication(self):
        self.app.dependency_overrides.pop(get_current_user)
        self.assertEqual(self.client.post("/api/upload/image", files={"file": ("test", b"x", "image/png")}).status_code, 403)
        self.assertFalse((self.root / "uploads").exists())

    def test_corrupt_image_is_rejected_before_external_storage_is_called(self):
        with patch.dict(os.environ, {"BLOG_UPLOAD_STORAGE": "oss"}), patch.object(upload, "_get_bucket") as bucket:
            response = self.client.post("/api/upload/image", files={"file": ("bad.png", b"not an image", "image/png")})
            self.assertEqual(response.status_code, 400)
            bucket.assert_not_called()

    def test_incomplete_oss_configuration_fails_without_network_or_local_write(self):
        stream = BytesIO()
        Image.new("RGB", (2, 2)).save(stream, format="PNG")
        with patch.dict(os.environ, {"BLOG_UPLOAD_STORAGE": "oss"}), patch.object(upload, "OSS_ACCESS_KEY_ID", ""), patch.object(upload.oss2, "Auth") as auth, patch.object(upload.oss2, "Bucket") as bucket:
            response = self.client.post("/api/upload/image", files={"file": ("image.png", stream.getvalue(), "image/png")})
        self.assertEqual(response.status_code, 503, response.text)
        self.assertEqual(response.json()["detail"], "图片存储尚未配置，请先完成存储配置")
        auth.assert_not_called()
        bucket.assert_not_called()
        self.assertFalse((self.root / "uploads").exists())

    def test_unknown_storage_mode_fails_without_cloud_or_local_write(self):
        stream = BytesIO()
        Image.new("RGB", (2, 2)).save(stream, format="PNG")
        with patch.dict(os.environ, {"BLOG_UPLOAD_STORAGE": "invalid"}), patch.object(upload, "_upload_to_oss") as cloud:
            response = self.client.post("/api/upload/image", files={"file": ("image.png", stream.getvalue(), "image/png")})
        self.assertEqual(response.status_code, 503, response.text)
        cloud.assert_not_called()
        self.assertFalse((self.root / "uploads").exists())


class AsyncUploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_slow_oss_does_not_block_other_event_loop_work(self):
        entered, release = threading.Event(), threading.Event()
        def slow_upload(key, content):
            entered.set()
            if not release.wait(3):
                raise TimeoutError()
        stream = BytesIO()
        Image.new('RGB', (2, 2)).save(stream, format='PNG')
        stream.seek(0)
        file = UploadFile(stream, filename='image.png', headers=Headers({'content-type': 'image/png'}))
        with patch.dict(os.environ, {'BLOG_UPLOAD_STORAGE': 'oss'}), patch.object(upload, '_upload_to_oss', slow_upload):
            task = asyncio.create_task(upload.upload_image(file, {}))
            try:
                async def heartbeat():
                    while not entered.is_set():
                        await asyncio.sleep(0.005)
                    return 'responsive'
                self.assertEqual(await asyncio.wait_for(heartbeat(), 1), 'responsive')
                self.assertFalse(task.done())
            finally:
                release.set()
                await task

    async def test_oss_failure_returns_retryable_error_without_credentials(self):
        stream = BytesIO()
        Image.new('RGB', (2, 2)).save(stream, format='PNG')
        stream.seek(0)
        file = UploadFile(stream, filename='image.png', headers=Headers({'content-type': 'image/png'}))
        with patch.dict(os.environ, {'BLOG_UPLOAD_STORAGE': 'oss'}), patch.object(upload, '_upload_to_oss', side_effect=TimeoutError('private detail')):
            with self.assertRaises(upload.HTTPException) as caught:
                await upload.upload_image(file, {})
            self.assertEqual(caught.exception.status_code, 502)
            self.assertNotIn('private detail', caught.exception.detail)
