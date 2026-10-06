from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.deps import get_session, get_current_user
from app.services import visitor_service

router = APIRouter(prefix="/api/visitors", tags=["访客记录"])
_optional_bearer = HTTPBearer(auto_error=False)


def _authenticated_visitor_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> dict:
    """新增明细接口缺少凭据时也明确返回 401，并复用项目令牌校验。"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return get_current_user(credentials)


@router.get("")
def list_recent_visitors(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    """获取最近访客列表"""
    visitors = visitor_service.get_recent_visitors(session, page, size)
    return {"code": 0, "data": visitors}


@router.get("/groups")
def list_visitor_ip_groups(
    search: str = Query("", max_length=45),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session),
    _: dict = Depends(_authenticated_visitor_admin),
):
    """按 IP 聚合访问记录，使用有限窗口。"""
    return {"code": 0, **visitor_service.get_ip_groups(session, search, offset, limit)}


@router.get("/group-visits")
def list_visitor_ip_paths(
    ip: str = Query(..., min_length=1, max_length=45),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    _: dict = Depends(_authenticated_visitor_admin),
):
    """读取某 IP 最近路径，使用有限窗口。"""
    return {"code": 0, **visitor_service.get_ip_visits(session, ip, offset, limit)}


@router.get("/count")
def visitor_count(session: Session = Depends(get_session)):
    """获取总访客数"""
    return {"code": 0, "count": visitor_service.get_visitor_count(session)}


@router.get("/location")
def get_visitor_location(
    request: Request,
):
    """获取当前访问者的地理位置"""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not ip:
        ip = request.headers.get("x-real-ip", "")
    if not ip:
        ip = request.client.host if request.client else ""

    geo = visitor_service._fetch_geo(ip)
    return {"code": 0, "data": geo}


@router.post("/record")
def record_visitor(
    request: Request,
    session: Session = Depends(get_session),
):
    """记录当前访问（前端调用）"""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not ip:
        ip = request.headers.get("x-real-ip", "")
    if not ip:
        ip = request.client.host if request.client else ""

    path = request.headers.get("x-path", "")
    ua = request.headers.get("user-agent", "")

    visitor_service.record_visit(session, ip, path, ua)
    return {"code": 0, "message": "ok"}


@router.delete("/{visitor_id}")
def delete_visitor(
    visitor_id: int,
    session: Session = Depends(get_session),
):
    """删除单条访客记录"""
    visitor_service.delete_visitor(session, visitor_id)
    return {"code": 0, "message": "ok"}


@router.delete("")
def clear_visitors(session: Session = Depends(get_session)):
    """清空所有访客记录"""
    visitor_service.clear_visitors(session)
    return {"code": 0, "message": "ok"}
