"""Kirameku Blog 一键启动脚本"""

import webbrowser
import uvicorn

PORT = 8000


def main():
    print(f"🚀 Kirameku Backend starting on http://localhost:{PORT}")
    print(f"   Admin Panel: http://localhost:{PORT}/admin")
    print(f"   API Docs:    http://localhost:{PORT}/docs")
    print()

    # 自动打开浏览器
    webbrowser.open(f"http://localhost:{PORT}/admin")

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=PORT,
        reload=True,
    )


if __name__ == "__main__":
    main()
