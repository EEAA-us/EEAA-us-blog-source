import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kirameku.db")
# Never sign login tokens with a shared example key, or generate a new key on restart.
SECRET_KEY = os.getenv("SECRET_KEY", "")
if (
    not SECRET_KEY.strip()
    or SECRET_KEY in {"change-this-local-secret", "your-secret-key"}
    or len(SECRET_KEY.encode("utf-8")) < 32
):
    raise RuntimeError(
        "SECRET_KEY must be a private random key of at least 32 UTF-8 bytes. "
        "Set it in backend/.env or the process environment before starting the backend. "
        'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8849,http://127.0.0.1:8849").split(",")

# GitHub OAuth
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")

# 阿里云 OSS 配置
OSS_ACCESS_KEY_ID = os.getenv("OSS_ACCESS_KEY_ID", "")
OSS_ACCESS_KEY_SECRET = os.getenv("OSS_ACCESS_KEY_SECRET", "")
OSS_BUCKET_NAME = os.getenv("OSS_BUCKET_NAME", "")
OSS_ENDPOINT = os.getenv("OSS_ENDPOINT", "")
OSS_CUSTOM_DOMAIN = os.getenv("OSS_CUSTOM_DOMAIN", "")
OSS_PREFIX = os.getenv("OSS_PREFIX", "uploads/")
