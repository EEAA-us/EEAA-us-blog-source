import { request, qs } from "./client";
import { readPublishedSelection } from "@/lib/published-content";
import { getCloudStatsIdentity } from "@/lib/cloud-stats-client";
import type { ArticleImageDimensions } from "@/lib/article-markdown";

const publishedMode = process.env.NEXT_PUBLIC_CONTENT_MODE === "published";

export interface PostItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  likes: number;
  word_count: number;
  reading_time: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostDetail extends PostItem {
  content: string;
  image_dimensions?: ArticleImageDimensions;
}

export async function refreshPublishedStats(posts: PostItem[]): Promise<PostItem[]> {
  if (!publishedMode || posts.length === 0) return posts;
  const batches: PostItem[][] = [];
  for (let i = 0; i < posts.length; i += 100) batches.push(posts.slice(i, i + 100));
  const stats = await Promise.all(batches.map(async (batch) => {
    try {
      const ids = batch.map((post) => post.id).join(",");
      const response = await fetch(`/api/posts/stats?ids=${encodeURIComponent(ids)}`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return {} as Record<string, { views: number; likes: number }>;
      const result = await response.json() as { posts?: Record<string, { views: number; likes: number }> };
      return result.posts ?? {};
    } catch {
      return {} as Record<string, { views: number; likes: number }>;
    }
  }));
  const byId = Object.assign({}, ...stats);
  return posts.map((post) => ({ ...post, ...(byId[String(post.id)] ?? {}) }));
}

export function getPosts(params?: {
  status?: string;
  category?: string;
  tag?: string;
  search?: string;
  page?: number;
  size?: number;
}, options: { includeStats?: boolean } = {}) {
  if (publishedMode) return readPublishedSelection((index) => {
    const size = params?.size ?? 10;
    const page = params?.page ?? 1;
    const category = index.categories.find((item) => item.slug === params?.category);
    const knownTagSlugs = new Set(index.posts.flatMap((item) => (item.tagSlugs as string[] | undefined) ?? []));
    const posts = index.posts.filter((post) => {
      if (params?.status && post.status !== params.status) return false;
      if (category && post.category !== category.name) return false;
      if (params?.tag && knownTagSlugs.has(params.tag) && !((post.tagSlugs as string[] | undefined) ?? []).includes(params.tag)) return false;
      return (params?.search ?? "").trim().split(/\s+/).filter(Boolean).every((word) =>
        String(post.searchText).includes(word.toLocaleLowerCase())
      );
    });
    const pagePosts = posts.slice((page - 1) * size, page * size).map((post) => {
      return Object.fromEntries(Object.entries(post).filter(([key]) => key !== "searchText" && key !== "tagSlugs")) as unknown as PostItem;
    });
    return pagePosts;
  }).then((pagePosts) => options.includeStats === false ? pagePosts : refreshPublishedStats(pagePosts));
  return request<PostItem[]>(`/api/posts${qs(params)}`);
}

export function getPostsCount(status?: string, filters?: { category?: string; search?: string }) {
  if (publishedMode) return readPublishedSelection((index) => {
    const category = index.categories.find((item) => item.slug === filters?.category);
    const count = index.posts.filter((post) => {
      if (status && post.status !== status) return false;
      if (category && post.category !== category.name) return false;
      return (filters?.search ?? "").trim().split(/\s+/).filter(Boolean).every((word) =>
        String(post.searchText).includes(word.toLocaleLowerCase())
      );
    }).length;
    return { count };
  });
  return request<{ count: number }>(
    `/api/posts/count${qs({ status, ...filters })}`
  );
}

export function getPostBySlug(slug: string) {
  if (publishedMode) return readPublishedSelection((index) => {
    const item = index.posts.find((post) => post.slug === slug);
    if (!item) throw new Error("Article not found");
    return item.id;
  }).then(async (id) => {
    const response = await fetch(`/content/posts/${id}.json`);
    if (!response.ok) throw new Error(`Published article unavailable (${response.status})`);
    return response.json() as Promise<PostDetail>;
  });
  return request<PostDetail>(`/api/posts/${slug}`);
}

export function getPostById(postId: number) {
  if (publishedMode) return fetch(`/content/posts/${postId}.json`).then(async (response) => {
    if (!response.ok) throw new Error(`Published article unavailable (${response.status})`);
    return response.json() as Promise<PostDetail>;
  });
  return request<PostDetail>(`/api/posts/detail/${postId}`);
}

export function likePost(postId: number, unlike = false) {
  if (publishedMode) return request<{ likes: number }>(`/api/posts/${postId}/${unlike ? "unlike" : "like"}`, {
    method: "POST",
    body: JSON.stringify({ browserId: getCloudStatsIdentity().browserId }),
  });
  return request<{ likes: number }>(`/api/posts/${postId}/${unlike ? "unlike" : "like"}`, {
    method: "POST",
  });
}
