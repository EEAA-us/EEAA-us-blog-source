"""Local-only, serialized publication. Never receives commands or credentials from HTTP."""
import json
import os
import shutil
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
STATE_FILE = ROOT / ".publish" / "state.json"
_lock = threading.Lock()
ACTIVE_PHASES = {"running", "exporting", "building", "previewing", "syncing", "promoting"}


def status():
    required = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_ORG_ID", "VERCEL_AUTOMATION_BYPASS_SECRET", "BLOG_PUBLISH_GIT_URL", "GITHUB_TOKEN", "NEXT_PUBLIC_SITE_URL", "BLOG_STATS_URL", "BLOG_STATS_ADMIN_TOKEN", "BLOG_STATS_SERVICE_TOKEN"]
    missing = [key for key in required if not os.getenv(key)]
    state = {"phase": "idle", "message": "尚未发布", "published": False}
    if STATE_FILE.exists():
        state.update(json.loads(STATE_FILE.read_text(encoding="utf-8")))
        if state.get("phase") in ACTIVE_PHASES and not _lock.locked():
            state.update(phase="interrupted", message="上次任务已中断；请检查云端版本后重试，未自动回退数据")
    state["missingConfig"] = missing
    state["ready"] = not missing
    return state


def _save(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    temporary.replace(STATE_FILE)


def start():
    previous = status()
    if previous["missingConfig"]:
        raise ValueError("请先配置免费平台账号和发布凭据；目前没有执行上传")
    if not _lock.acquire(blocking=False):
        raise RuntimeError("已有发布任务正在运行")
    state = {"jobId": uuid.uuid4().hex, "phase": "running", "message": "正在生成并检查发布版本", "published": False, "startedAt": datetime.now(timezone.utc).isoformat()}
    state["lastSuccessfulUrl"] = previous.get("lastSuccessfulUrl") or previous.get("url")
    try:
        _save(state)
        threading.Thread(target=_execute, args=(state,), daemon=True).start()
    except Exception:
        _lock.release()
        raise
    return state


def _execute(state):
    try:
        node = os.getenv("BLOG_NODE_BIN") or shutil.which("node")
        if not node:
            raise RuntimeError("未找到Node.js，未上传")
        completed = subprocess.run([node, str(ROOT / "scripts/publish-site.mjs")], cwd=ROOT, env=os.environ.copy(), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=3600, check=True)
        result = json.loads(completed.stdout.strip().splitlines()[-1])
        state.update(phase="completed", message="已完成发布", published=result["published"], url=result.get("url"), lastSuccessfulUrl=result.get("url"), posts=result.get("posts"))
    except subprocess.CalledProcessError as error:
        state.update(phase="failed", message=(error.stderr or "发布失败；正式站可能未切换，请核对云端版本").strip()[-3000:])
    except Exception as error:
        state.update(phase="failed", message=str(error))
    finally:
        for key, value in os.environ.items():
            if any(part in key.upper() for part in ["TOKEN", "SECRET", "PASSWORD", "KEY"]) and len(value) >= 8:
                state["message"] = state["message"].replace(value, "[redacted]")
        state["finishedAt"] = datetime.now(timezone.utc).isoformat()
        try:
            _save(state)
        finally:
            _lock.release()
