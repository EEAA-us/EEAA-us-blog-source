from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("Passwords must not exceed 72 UTF-8 bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    encoded = plain.encode("utf-8")
    if len(encoded) > 72:
        return False
    return bcrypt.checkpw(encoded, hashed.encode("utf-8"))


def create_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="无效的令牌")


def get_optional_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict | None:
    if credentials is None:
        return None
    user = decode_token(credentials.credentials)
    if user.get("admin") is not True:
        raise HTTPException(status_code=403, detail="仅站长可以管理博客")
    return user


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    # Preserve the existing required-login contract while sharing token validation.
    user = get_optional_current_user(credentials)
    if user is None:
        raise HTTPException(status_code=403, detail="Not authenticated")
    return user
