from urllib.parse import urlparse
import ipaddress
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from app.deps import get_current_user, get_session
from app.models import User
from app.services import publish_service
from app.services.ai_service import get_statistics, parse_iso_date

router = APIRouter(prefix="/api/publish", tags=["本机发布"])


def local_admin(request: Request, token: dict = Depends(get_current_user), session: Session = Depends(get_session)):
    try:
        local = request.client and ipaddress.ip_address(request.client.host).is_loopback
    except ValueError:
        local = False
    origin = request.headers.get("origin")
    hostname = request.url.hostname
    if not local or hostname not in {"localhost", "127.0.0.1", "::1"} or (origin and urlparse(origin).hostname not in {"localhost", "127.0.0.1", "::1"}):
        raise HTTPException(403, "仅允许本机站长管理")
    user = session.exec(select(User).where(User.username == token.get("sub"))).first()
    if not user or not user.is_admin:
        raise HTTPException(403, "需要站长权限")
    return user


@router.get("/status")
def publication_status(_=Depends(local_admin)):
    return publish_service.status()


@router.get("/statistics")
def online_statistics(start: str | None = None, end: str | None = None, _=Depends(local_admin)):
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    return get_statistics(parse_iso_date(start) if start else today - timedelta(days=6), parse_iso_date(end) if end else today)


@router.post("/start", status_code=202)
def publication_start(_=Depends(local_admin)):
    try:
        return publish_service.start()
    except ValueError as error:
        raise HTTPException(503, str(error)) from error
    except RuntimeError as error:
        raise HTTPException(409, str(error)) from error
