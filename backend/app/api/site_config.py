from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.deps import get_session
from app.schemas import SiteConfigUpdate, SiteConfigOut
from app.schemas.hero_media_catalog import HeroMediaCatalog
from app.services import site_config_service
from app.services import hero_media_catalog_service
from app.schemas.project_covers import ProjectCovers
from app.deps import get_current_user
from app.schemas.blog_appearance import BlogAppearanceDefaults

router = APIRouter(prefix="/api/site-config", tags=["站点配置"])


class SiteConfigCreate(BaseModel):
    key: str
    value: str = ""
    description: str = ""


@router.get("/media-catalog")
def get_media_catalog(session: Session = Depends(get_session)):
    return hero_media_catalog_service.get_catalog(session)


@router.put("/media-catalog")
def put_media_catalog(
    data: HeroMediaCatalog,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return hero_media_catalog_service.save_catalog(session, data.model_dump(by_alias=True, exclude_none=True))


@router.get("/project-covers")
def get_project_covers(session: Session = Depends(get_session)):
    return site_config_service.get_project_covers(session)


@router.put("/project-covers")
def put_project_covers(
    data: ProjectCovers,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_config_service.save_project_covers(session, data.model_dump())


@router.get("/appearance-defaults")
def get_appearance_defaults(session: Session = Depends(get_session)):
    return site_config_service.get_blog_appearance(session)


@router.put("/appearance-defaults")
def put_appearance_defaults(
    data: BlogAppearanceDefaults,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_config_service.save_blog_appearance(session, data.model_dump(exclude_none=True))


@router.get("")
def get_all_config(session: Session = Depends(get_session)):
    return site_config_service.get_all_config(session)


@router.get("/list")
def get_all_config_list(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_config_service.get_all_config_list(session)


@router.get("/{key}")
def get_config(key: str, session: Session = Depends(get_session)):
    return site_config_service.get_config(session, key)


@router.post("", response_model=SiteConfigOut)
def create_config(
    data: SiteConfigCreate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_config_service.create_config(session, data.key, data.value, data.description)


@router.put("/{key}", response_model=SiteConfigOut)
def update_config(
    key: str,
    data: SiteConfigUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_config_service.update_config(session, key, data)


@router.put("")
def batch_update_config(
    configs: dict,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_config_service.batch_update_config(session, configs)


@router.delete("/{key}")
def delete_config(
    key: str,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    site_config_service.delete_config(session, key)
    return {"ok": True}
