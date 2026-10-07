"""Idempotently import the curated STM32 Obsidian notes into the blog.

The command is a dry run unless ``--apply`` is supplied. It never changes the
Obsidian vault and only copies image assets that are referenced by STM32 notes.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlmodel import Session, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import engine
from app.models import Category, Post
from app.schemas import PostCreate, PostUpdate
from app.services import post_service


@dataclass(frozen=True)
class NoteSpec:
    relative_path: str
    slug: str
    description: str
    tags: tuple[str, ...]


NOTES = (
    NoteSpec("总目录.md", "stm32-study-guide", "STM32 学习笔记的总目录与推荐阅读顺序。", ("入门", "学习路线")),
    NoteSpec("一、基础知识/1-STM32整体框架.md", "stm32-overview", "从 Cortex-M3、存储器、总线、外设、DMA 和寄存器认识 STM32F1。", ("入门", "芯片结构")),
    NoteSpec("一、基础知识/2-开发方式.md", "stm32-development-methods", "比较寄存器、标准外设库与 HAL 三种 STM32 开发方式。", ("入门", "开发方式")),
    NoteSpec("一、基础知识/3-工程文件与库函数.md", "stm32-project-files-and-libraries", "理解启动文件、底层支持、标准外设库与用户文件的分工。", ("入门", "工程结构")),
    NoteSpec("一、基础知识/4-Keil工程总体框架.md", "stm32-keil-project-structure", "认识 Keil 工程文件、真实路径、工程分组、构建输出与调试配置。", ("Keil", "工程结构")),
    NoteSpec("一、基础知识/5-Keil文件配置.md", "stm32-keil-file-configuration", "在 Keil 中创建和加入文件、配置包含路径、宏与 ST-Link。", ("Keil", "工程配置")),
    NoteSpec("一、基础知识/6-编译烧录与运行.md", "stm32-build-flash-run", "梳理 STM32 程序从编译、连接、烧录到上电运行的完整过程。", ("Keil", "烧录")),
    NoteSpec("二、GPIO基础/1-GPIO模块.md", "stm32-gpio-module", "理解 STM32F1 GPIO 的端口、寄存器、八种模式与最小配置流程。", ("GPIO", "寄存器")),
)

IMAGE_PATTERN = re.compile(r"!\[([^]]*)\]\(([^)]+)\)|<img\s+[^>]*src=[\"']([^\"']+)[\"'][^>]*>", re.I)
WIKI_PATTERN = re.compile(r"\[\[([^]|#]+)(?:#([^]|]+))?(?:\|([^]]+))?\]\]")
LOCAL_WIKI_PATTERN = re.compile(r"\[\[#([^]|]+)(?:\|([^]]+))?\]\]")


def _title(markdown: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+)$", markdown, re.M)
    return match.group(1).strip() if match else fallback


def _asset_name(source: Path) -> str:
    digest = hashlib.sha1(str(source).encode("utf-8")).hexdigest()[:12]
    return f"{digest}{source.suffix.lower()}"


def _convert_content(markdown: str, note_path: Path, slug_by_stem: dict[str, str], asset_dir: Path, apply: bool) -> tuple[str, list[Path]]:
    copied: list[Path] = []

    def replace_image(match: re.Match[str]) -> str:
        html_alt = re.search(r"\balt=[\"']([^\"']*)[\"']", match.group(0), re.I)
        alt = match.group(1) or (html_alt.group(1) if html_alt else "STM32 笔记图片")
        raw_path = match.group(2) or match.group(3) or ""
        source = (note_path.parent / raw_path).resolve()
        if not source.is_file():
            raise FileNotFoundError(f"图片不存在: {source}")
        target_name = _asset_name(source)
        target = asset_dir / target_name
        copied.append(target)
        if apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        return f"![{alt}](/stm32-notes/{target_name})"

    content = IMAGE_PATTERN.sub(replace_image, markdown)
    content = re.sub(r"^#\s+.+\n+", "", content, count=1)
    headings = [match.group(1).strip() for match in re.finditer(r"^#{1,3}\s+(.+?)\s*$", content, re.M)]

    def replace_local_wiki(match: re.Match[str]) -> str:
        target, label = match.groups()
        target = target.strip()
        if target not in headings:
            raise ValueError(f"找不到文内标题: {target} ({note_path})")
        return f"[{label or target}](#heading-{headings.index(target)})"

    content = LOCAL_WIKI_PATTERN.sub(replace_local_wiki, content)

    def replace_wiki(match: re.Match[str]) -> str:
        target, _anchor, label = match.groups()
        stem = Path(target.replace("\\", "/")).stem
        slug = slug_by_stem.get(stem)
        text = label or stem.split("-", 1)[-1]
        return f"[{text}](/posts/{slug}#page-content)" if slug else text

    content = WIKI_PATTERN.sub(replace_wiki, content)
    return content.strip() + "\n", copied


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, required=True, help="Obsidian vault root")
    parser.add_argument("--apply", action="store_true", help="write posts and copy referenced images")
    args = parser.parse_args()

    note_root = args.vault.resolve() / "STM32学习"
    asset_dir = Path(__file__).resolve().parents[2] / "public" / "stm32-notes"
    slug_by_stem = {Path(spec.relative_path).stem: spec.slug for spec in NOTES}
    prepared: list[tuple[NoteSpec, str, str, list[Path]]] = []
    for spec in NOTES:
        path = note_root / spec.relative_path
        markdown = path.read_text(encoding="utf-8")
        content, assets = _convert_content(markdown, path, slug_by_stem, asset_dir, args.apply)
        prepared.append((spec, _title(markdown, path.stem), content, assets))

    action = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{action}] {len(prepared)} STM32 notes; {len({p for *_, paths in prepared for p in paths})} referenced images")
    if not args.apply:
        for spec, title, content, _assets in prepared:
            print(f"  {spec.slug}: {title} ({len(content)} chars)")
        return

    with Session(engine) as session:
        category = session.exec(select(Category).where(Category.slug == "stm32")).first()
        if not category or category.id is None:
            raise RuntimeError("缺少 slug=stm32 的分类，请先在后台创建 STM32 分类")
        for spec, title, content, _assets in prepared:
            existing = session.exec(select(Post).where(Post.slug == spec.slug)).first()
            values = dict(
                title=title,
                description=spec.description,
                content=content,
                category_id=category.id,
                tags=list(spec.tags),
                status="published",
                is_pinned=spec.slug == "stm32-study-guide",
            )
            if existing and existing.id is not None:
                current = post_service.get_post_by_id(session, existing.id, include_unpublished=True)
                if (
                    all(current[key] == values[key] for key in ("title", "description", "content", "status", "is_pinned"))
                    and existing.category_id == category.id
                    and set(current["tags"]) == set(values["tags"])
                ):
                    print(f"  unchanged {spec.slug}")
                    continue
                post_service.update_post(session, existing.id, PostUpdate(**values))
                print(f"  updated {spec.slug}")
            else:
                post_service.create_post(session, PostCreate(slug=spec.slug, **values))
                print(f"  created {spec.slug}")


if __name__ == "__main__":
    main()
