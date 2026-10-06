from pydantic import BaseModel, ConfigDict, field_validator
import re
from urllib.parse import unquote


def valid_cover_url(value: str) -> str:
    if len(value) > 2048 or not value:
        raise ValueError("封面地址不能为空且不能超过2048字符")
    if value.startswith("https://") and re.fullmatch(r"https://[^\s]+", value):
        return value
    decoded = unquote(value)
    if re.fullmatch(r"/(?:images|uploads)/[A-Za-z0-9_./%() -]+", value) and ".." not in decoded.split("/") and "\\" not in decoded:
        return value
    raise ValueError("封面仅支持HTTPS或本站/images、/uploads绝对路径")


class ProjectCovers(BaseModel):
    model_config = ConfigDict(extra="forbid")
    covers: dict[str, str]

    @field_validator("covers")
    @classmethod
    def validate_covers(cls, covers: dict[str, str]) -> dict[str, str]:
        if len(covers) > 20:
            raise ValueError("项目封面最多20项")
        for project_id, url in covers.items():
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", project_id):
                raise ValueError("项目ID格式无效")
            valid_cover_url(url)
        return covers
