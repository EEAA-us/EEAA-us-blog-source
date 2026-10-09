import type { PostDetail } from "@/app/api/posts";
import { withRequestDeadline } from "@/lib/bounded-request";

const articles = new Map<number, { request: Promise<PostDetail>; freshUntil: number }>();

// Keep a small, short-lived cache for readers switching back to a chapter.
// Shared requests do not share mutable view/like state between consumers.
export function loadPublishedArticle(id: number): Promise<PostDetail> {
  let entry = articles.get(id);
  if (!entry || Date.now() >= entry.freshUntil) {
    const request = withRequestDeadline(new AbortController().signal, 15_000, async signal => {
      const response = await fetch(`/content/posts/${id}.json`, { signal });
      if (!response.ok) throw new Error(`Published article unavailable (${response.status})`);
      const data = await response.json() as PostDetail;
      if (data.id !== id || typeof data.content !== "string") throw new Error("Invalid published article");
      return data;
    });
    entry = { request, freshUntil: Infinity };
    articles.delete(id);
    articles.set(id, entry);
    const created = entry;
    void request.then(() => { created.freshUntil = Date.now() + 30_000; }, () => {
      if (articles.get(id) === created) articles.delete(id);
    });
    while (articles.size > 20) articles.delete(articles.keys().next().value!);
  }
  return entry.request.then(data => structuredClone(data));
}
