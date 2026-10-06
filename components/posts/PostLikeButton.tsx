"use client";

import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { getCloudStatsIdentity } from "@/lib/cloud-stats-client";
import { useTranslation } from "@/lib/i18n";

type LikeRecord = { liked: boolean; likes: number };
const pendingPosts = new Set<number>();
const keyFor = (id: number) => `post-like-v1:${id}`;
function readLike(id: number): LikeRecord | null {
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(id)) || "null");
    return typeof saved?.liked === "boolean" && Number.isInteger(saved.likes) && saved.likes >= 0 ? saved : null;
  } catch { return null; }
}

export default function PostLikeButton({ postId, initialLikes, compact = false, onDark = false }: {
  postId: number; initialLikes: number; compact?: boolean; onDark?: boolean;
}) {
  const { language } = useTranslation();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = liked
    ? language === "zh" ? "取消点赞" : language === "ja" ? "いいねを取り消す" : "Unlike"
    : language === "zh" ? "点赞" : language === "ja" ? "いいね" : "Like";
  useEffect(() => {
    let active = true;
    const sync = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== keyFor(postId)) return;
      const saved = readLike(postId);
      setLiked(saved?.liked ?? false);
      // The initial count is fresh server data; storage only carries newer local updates.
      if (event && saved) setLikes(saved.likes);
    };
    queueMicrotask(() => { if (active) { setLikes(initialLikes); sync(); } });
    window.addEventListener("storage", sync);
    window.addEventListener(`post-like:${postId}`, sync);
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
      window.removeEventListener(`post-like:${postId}`, sync);
    };
  }, [postId, initialLikes]);
  const toggle = async () => {
    if (pendingPosts.has(postId)) return;
    pendingPosts.add(postId); setPending(true); setError("");
    const change = async () => {
      const alreadyLiked = readLike(postId)?.liked ?? liked;
      // Confirm persistent storage before recording a server-side like.
      const old = localStorage.getItem(keyFor(postId));
      localStorage.setItem(keyFor(postId), old || JSON.stringify({ liked: false, likes }));
      const identity = getCloudStatsIdentity();
      const response = await fetch(`/api/posts/${postId}/${alreadyLiked ? "unlike" : "like"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(identity),
      });
      if (!response.ok) throw new Error(`Like request failed (${response.status})`);
      const result = await response.json() as { likes: number };
      if (!Number.isInteger(result.likes) || result.likes < 0) throw new Error("Invalid like response");
      const record = { liked: !alreadyLiked, likes: result.likes };
      localStorage.setItem(keyFor(postId), JSON.stringify(record));
      setLiked(record.liked); setLikes(record.likes);
      window.dispatchEvent(new Event(`post-like:${postId}`));
    };
    try {
      if (navigator.locks) await navigator.locks.request(keyFor(postId), change);
      else await change();
    } catch {
      setError(language === "zh" ? "点赞未完成，请检查网络及浏览器存储后重试。" : language === "ja" ? "いいねに失敗しました。再試行してください。" : "Could not save your like. Please try again.");
    } finally { pendingPosts.delete(postId); setPending(false); }
  };
  return <span className={`relative z-20 inline-flex ${compact ? "" : "flex-col items-start gap-2"}`}>
    <button type="button" aria-label={`${label} · ${likes}`} aria-pressed={liked} disabled={pending}
      title={language === "zh" ? "当前浏览器记住点赞，再点可取消" : label}
      onClick={event => { event.preventDefault(); event.stopPropagation(); void toggle(); }}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 font-semibold transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${liked ? "text-rose-500 bg-rose-500/10" : onDark ? "text-white/90 hover:bg-white/15 hover:text-rose-200" : "text-slate-500 bg-slate-100/70 hover:bg-rose-500/10 hover:text-rose-500 dark:bg-white/5"} ${compact ? "text-xs" : "px-4 py-2 text-sm"}`}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} aria-hidden="true" />}
      {!compact && <span>{label}</span>}<span>{likes}</span>
    </button>
    {error && <span role="alert" className={`text-xs text-rose-500 ${compact ? "absolute bottom-full right-0 mb-2 w-48 rounded-lg bg-white p-2 shadow" : ""}`}>{error}</span>}
  </span>;
}
