import { withRequestDeadline } from "@/lib/bounded-request";
import { parseTiboPosts } from "@/lib/tibo-posts";

export async function readTiboFeed(signal: AbortSignal) {
  return withRequestDeadline(signal, 12_000, async bounded => {
    const response = await fetch("https://x.com/thsottiaux", {
      signal: bounded, headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" }, next: { revalidate: 180 },
    });
    if (!response.ok) throw new Error("动态来源暂不可用");
    const html = await response.text();
    const posts = parseTiboPosts(html);
    if (!posts.length) throw new Error("暂时无法从公开主页读取动态");
    return { posts, checkedAt: new Date().toISOString(), source: "X公开主页", notice: "展示公开主页当前可获取的动态，可能不完整；原文与机器翻译分别显示。" };
  });
}
