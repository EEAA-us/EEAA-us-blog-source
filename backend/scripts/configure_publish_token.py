"""Local masked entry for the dedicated GitHub publication token; no secret output."""
import json
import os
from urllib.parse import urlparse
from dotenv import load_dotenv
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import set_key

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE)
REPOSITORY = urlparse(os.getenv("BLOG_PUBLISH_GIT_URL", "")).path.strip("/").removesuffix(".git")


def save_token(token):
    if len(REPOSITORY.split("/")) != 2 or not all(REPOSITORY.split("/")):
        raise ValueError("先在 backend/.env 配置 BLOG_PUBLISH_GIT_URL，指向自己的私有部署仓库。")
    if not token.startswith("github_pat_") or any(c.isspace() for c in token):
        raise ValueError("请填写 GitHub Fine-grained token，不使用旧的全账号令牌。")
    request = Request(
        f"https://api.github.com/repos/{REPOSITORY}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            repository = json.load(response)
    except HTTPError as error:
        raise ValueError(f"GitHub 返回 {error.code}，请核对令牌、选定仓库及有效期。") from None
    except (URLError, TimeoutError):
        raise ValueError("暂时无法连接 GitHub，请稍后重试。") from None
    if repository.get("full_name") != REPOSITORY or not repository.get("private") or not repository.get("permissions", {}).get("push"):
        raise ValueError("令牌必须能写入指定的私有部署仓库。")
    # API access alone cannot prove that no other repository was selected.
    if not ENV_FILE.is_file():
        raise ValueError("原 backend/.env 不存在，未创建或覆盖配置。")
    set_key(str(ENV_FILE), "GITHUB_TOKEN", token)


def main():
    window = tk.Tk()
    window.title("博客一键发布 · GitHub 专用令牌")
    window.geometry("580x265")
    window.resizable(False, False)
    tk.Label(window, text="将生成的令牌粘贴到这里，不要发送到聊天。", font=("Microsoft YaHei", 12)).pack(pady=(18, 10))
    tk.Label(window, text=f"仅选择 {REPOSITORY or 'backend/.env 中配置的私有部署仓库'}\nContents: Read and write；不要选择其他仓库或额外权限。", justify="left").pack(pady=5)
    entry = tk.Entry(window, show="●", width=65)
    entry.pack(pady=12)
    state = tk.StringVar(value="令牌只保存到本机 backend/.env，不上传到部署仓库。")
    tk.Label(window, textvariable=state, wraplength=550).pack(pady=5)
    results = []

    def validate():
        token = entry.get().strip()
        button.configure(state="disabled")
        state.set("正在检查指定私有仓库的访问权限…")

        def worker():
            try:
                save_token(token)
                results.append(None)
            except ValueError as error:
                results.append(str(error))
            except Exception:
                results.append("本机配置保存失败；未显示令牌，请检查文件权限后重试。")

        threading.Thread(target=worker, daemon=True).start()

    def poll():
        if results:
            error = results.pop(0)
            button.configure(state="normal")
            if error:
                state.set(error)
            else:
                entry.delete(0, tk.END)
                messagebox.showinfo("已保存", "专用令牌已保存到本机。\n回到聊天告诉我“已保存”，我会继续验证发布。")
                window.destroy()
                return
        window.after(100, poll)

    button = tk.Button(window, text="检查并安全保存", command=validate)
    button.pack(pady=8)
    entry.focus_set()
    window.after(100, poll)
    window.mainloop()


if __name__ == "__main__":
    main()
