import { readFile } from "node:fs/promises";
import path from "node:path";
import PostDetailClient from "./PostDetailClient";
import type { PostDetail } from "@/app/api/posts";

const publishedMode = process.env.NEXT_PUBLIC_CONTENT_MODE === "published";
const publicContent = path.join(process.cwd(), "public", "content");

export async function generateStaticParams() {
  if (!publishedMode) return [];
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "data", "published-manifest.json"), "utf8")) as Array<{ id: number; slug: string }>;
  return manifest.map(({ slug }) => ({ slug }));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!publishedMode) return <PostDetailClient />;
  const { slug } = await params;
  const index = JSON.parse(await readFile(path.join(publicContent, "index.json"), "utf8")) as { posts: Array<{ id: number; slug: string }> };
  const post = index.posts.find((item) => item.slug === slug);
  if (!post) return <PostDetailClient />;
  const detail = JSON.parse(await readFile(path.join(publicContent, "posts", `${post.id}.json`), "utf8")) as PostDetail;
  return <PostDetailClient key={slug} initialPost={detail} />;
}
