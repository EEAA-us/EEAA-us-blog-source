"""stdio MCP bridge to the loopback-only blog AI API."""

from __future__ import annotations

import ipaddress
import os
import sys
from urllib.parse import urlsplit

import httpx
from mcp.server.fastmcp import FastMCP


mcp = FastMCP("kirameku-blog")


def _base_url() -> str:
    value = os.getenv("BLOG_AI_API_URL", "http://127.0.0.1:8000").strip()
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ""
        try:
            is_local = host.lower() == "localhost" or ipaddress.ip_address(host).is_loopback
        except ValueError:
            is_local = False
        port = parsed.port
    except ValueError:
        raise RuntimeError("BLOG_AI_API_URL must point to a local HTTP address") from None
    if (
        not is_local
        or parsed.scheme != "http"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
        or port is not None and not 1 <= port <= 65535
    ):
        raise RuntimeError("BLOG_AI_API_URL must point to a local HTTP address")
    return value.rstrip("/")


def _request(method: str, path: str, *, scope: str = "read", params=None, json_body=None):
    token_name = "BLOG_AI_DRAFT_TOKEN" if scope == "draft" else "BLOG_AI_READ_TOKEN"
    token = os.getenv(token_name, "")
    if len(token) < 32:
        raise RuntimeError(f"{token_name} is not configured with a 32 character token")
    try:
        with httpx.Client(timeout=10.0, trust_env=False, follow_redirects=False) as client:
            response = client.request(
                method,
                f"{_base_url()}{path}",
                params=params,
                json=json_body,
                headers={"Authorization": f"Bearer {token}", "Host": "localhost"},
            )
    except httpx.HTTPError:
        raise RuntimeError("Local blog API is unavailable") from None
    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", "request rejected")
        except (ValueError, AttributeError):
            detail = "request rejected"
        raise RuntimeError(f"Blog API returned {response.status_code}: {detail}")
    return response.json()


@mcp.tool()
def get_statistics(start: str, end: str) -> dict:
    """Get Shanghai-time visitor statistics and published article ranking for inclusive dates YYYY-MM-DD."""
    return _request("GET", "/api/ai/stats", params={"start": start, "end": end})


@mcp.tool()
def search_posts(search: str = "", page: int = 1, size: int = 20) -> dict:
    """Search draft posts without changing view counts."""
    return _request("GET", "/api/ai/posts", params={"search": search, "status": "draft", "page": page, "size": size})


@mcp.tool()
def read_post(post_id: int) -> dict:
    """Read an article by ID without incrementing its view count."""
    return _request("GET", f"/api/ai/posts/{post_id}")


@mcp.tool()
def update_draft(
    post_id: int,
    expected_updated_at: str,
    title: str | None = None,
    description: str | None = None,
    content: str | None = None,
) -> dict:
    """Update fields on a draft only. Pass its latest updated_at value to detect concurrent edits."""
    body = {"expected_updated_at": expected_updated_at}
    for key, value in (("title", title), ("description", description), ("content", content)):
        if value is not None:
            body[key] = value
    return _request("PATCH", f"/api/ai/drafts/{post_id}", scope="draft", json_body=body)


@mcp.tool()
def restore_draft_revision(post_id: int, revision_id: int, expected_updated_at: str) -> dict:
    """Restore a saved draft revision explicitly, using the latest updated_at value."""
    return _request(
        "PATCH",
        f"/api/ai/drafts/{post_id}/restore/{revision_id}",
        scope="draft",
        json_body={"expected_updated_at": expected_updated_at},
    )


@mcp.tool()
def get_capabilities() -> dict:
    """Return the local AI API capabilities. Comments, messages, publishing, and deletion are disabled."""
    return {
        "statistics": True,
        "draftSearch": True,
        "postRead": True,
        "draftUpdate": True,
        "draftRevisionRestore": True,
        "comments": False,
        "messages": False,
        "publishing": False,
        "deletion": False,
        "rawSql": False,
    }


if __name__ == "__main__":
    if "--help" in sys.argv[1:] or "-h" in sys.argv[1:]:
        print("""Personal blog MCP server (stdio)

Required backend environment:
  BLOG_AI_READ_TOKEN       Local read credential, at least 32 characters
  BLOG_AI_DRAFT_TOKEN      Separate draft-write credential, at least 32 characters
  BLOG_STATS_URL           Worker base URL for live visitor statistics
  BLOG_STATS_ADMIN_TOKEN   Worker admin bearer token, at least 32 characters

Optional MCP environment:
  BLOG_AI_API_URL          Local backend URL (default http://127.0.0.1:8000); loopback only

Tools: get_statistics, search_posts, read_post, update_draft,
restore_draft_revision, get_capabilities.
Comments, messages, publishing, deletion and raw SQL are disabled.
""")
        raise SystemExit(0)
    mcp.run(transport="stdio")
