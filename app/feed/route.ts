import { NextResponse } from "next/server";
import { siteConfig } from "@/siteConfig";
import { marked } from "marked";
import type { PostItem } from "@/app/api/posts";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const revalidate = 3600;

const BACKEND_URL = "http://127.0.0.1:8000";

const FEED_URL = process.env.NEXT_PUBLIC_CONTENT_MODE === "published"
  ? (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/$/, "")
  : siteConfig.url;
// RSS 2.0 author is optional and expects an email address.
const FEED_AUTHOR = siteConfig.social.email ? `${siteConfig.social.email} (${siteConfig.authorName})` : "";

interface PostDetail extends PostItem {
  content: string;
}

export async function GET() {
  try {
    let posts: PostItem[];
    let detailResults: PromiseSettledResult<PostDetail>[];
    if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") {
      const contentDir = path.join(process.cwd(), "public", "content");
      const index = JSON.parse(await readFile(path.join(contentDir, "index.json"), "utf8")) as { posts: PostItem[] };
      posts = index.posts.slice(0, 10);
      detailResults = await Promise.all(posts.map(async (post) => {
        const detail = await readFile(path.join(contentDir, "posts", `${post.id}.json`), "utf8");
        return JSON.parse(detail) as PostDetail;
      }).map((promise) => promise.then(
        (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<PostDetail>,
        (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult,
      )));
    } else {
      const listRes = await fetch(`${BACKEND_URL}/api/posts?status=published&size=10`, { cache: "no-store" });
      if (!listRes.ok) throw new Error(`Backend returned ${listRes.status}`);
      posts = await listRes.json();
      detailResults = await Promise.all(posts.map((post) => fetch(`${BACKEND_URL}/api/posts/detail/${post.id}`, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error(`Article returned ${r.status}`);
        return r.json() as Promise<PostDetail>;
      }).then(
        (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<PostDetail>,
        (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult,
      )));
    }

    const items = (
      await Promise.all(
        posts.map(async (post, i) => {
          const detail = detailResults[i]?.status === "fulfilled" ? detailResults[i].value : null;

          return generateItem(post, detail);
        })
      )
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteConfig.title)}</title>
    <link>${FEED_URL}</link>
    <description>${escapeXml(siteConfig.bio)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${FEED_URL}/feed" rel="self" type="application/rss+xml"/>
    <generator>Next.js</generator>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("RSS generation failed:", error);
    return new NextResponse("Failed to generate RSS feed", { status: 500 });
  }
}

async function generateItem(
  post: PostItem,
  detail: PostDetail | null
): Promise<string> {
  const postUrl = `${FEED_URL}/posts/${post.slug}`;
  const pubDate = post.published_at
    ? new Date(post.published_at).toUTCString()
    : new Date(post.created_at).toUTCString();

  const categories = post.tags
    .map((tag) => `      <category>${escapeXml(tag)}</category>`)
    .join("\n");

  // 全文 HTML（markdown → HTML）
  let contentHtml = "";
  if (detail?.content) {
    try {
      contentHtml = await marked.parse(detail.content);
    } catch {
      contentHtml = escapeXml(detail.content);
    }
  }

  return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description><![CDATA[${post.description || ""}]]></description>
      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      ${FEED_AUTHOR ? `<author>${escapeXml(FEED_AUTHOR)}</author>` : ""}${categories ? `\n${categories}` : ""}
    </item>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
