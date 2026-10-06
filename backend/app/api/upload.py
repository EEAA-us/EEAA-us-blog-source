import uuid
import os
from pathlib import Path
from io import BytesIO

import oss2
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from PIL import Image
from starlette.concurrency import run_in_threadpool

from app.deps import get_current_user
from app.config import (
    OSS_ACCESS_KEY_ID,
    OSS_ACCESS_KEY_SECRET,
    OSS_BUCKET_NAME,
    OSS_ENDPOINT,
    OSS_CUSTOM_DOMAIN,
    OSS_PREFIX,
)

router = APIRouter(prefix="/api/upload", tags=["上传"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


def _get_bucket():
    if not all((OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME, OSS_ENDPOINT, OSS_CUSTOM_DOMAIN)):
        raise HTTPException(503, "图片存储尚未配置，请先完成存储配置")
    auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME, connect_timeout=20)


def _upload_to_oss(key: str, content: bytes):
    # Both client creation and network I/O belong outside the event loop.
    _get_bucket().put_object(key, content)


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}")

    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "文件大小不能超过 10MB")

    # 检测方向
    orientation = "landscape"
    try:
        img = Image.open(BytesIO(content))
        w, h = img.size
        orientation = "landscape" if w >= h else "portrait"
    except Exception:
        pass

    if file.content_type != "image/svg+xml":
        try:
            Image.open(BytesIO(content)).verify()
        except Exception as error:
            raise HTTPException(400, "不是有效的图片文件") from error

    # Extensions come from the accepted media type, never from a caller-supplied path.
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg"}[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    storage = os.getenv("BLOG_UPLOAD_STORAGE", "oss")
    if storage not in {"local", "oss"}:
        raise HTTPException(503, "图片存储配置无效，请检查存储模式")
    if storage == "local":
        if file.content_type == "image/svg+xml":
            raise HTTPException(400, "本地图片上传暂不接受SVG，请使用PNG、JPEG、WebP或GIF")
        target = Path(__file__).resolve().parents[2] / "uploads" / filename
        target.parent.mkdir(exist_ok=True)
        with target.open("xb") as output:
            output.write(content)
        return {"url": f"/uploads/{filename}", "orientation": orientation}
    oss_key = f"{OSS_PREFIX}{filename}"

    # 上传到 OSS
    try:
        await run_in_threadpool(_upload_to_oss, oss_key, content)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(502, "图片上传失败，请稍后重试") from error

    url = f"{OSS_CUSTOM_DOMAIN}/{oss_key}"
    return {"url": url, "orientation": orientation}
