"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { withRequestDeadline } from "@/lib/bounded-request";
import type { TiboPost } from "@/lib/tibo-posts";

interface Feed { posts: TiboPost[]; checkedAt: string; notice: string }
interface Translation { text?: string; error?: string }
export default function TiboApp() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [attempt, setAttempt] = useState(0);
  const translated = useRef<Record<string, { original: string; text: string }>>({});

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    queueMicrotask(async () => {
      if (!active) return;
      setLoading(true); setError("");
      try {
        const data = await withRequestDeadline(controller.signal, 15_000, async signal => {
          const response = await fetch("/api/tibo", { signal });
          const json = await response.json();
          if (!response.ok || !Array.isArray(json.posts)) throw new Error(json.message || "动态无法加载");
          return json as Feed;
        });
        if (!active) return;
        setFeed(data); setLoading(false);
        // Original posts are readable immediately. Translate sequentially to
        // respect the public service's limit; closing cancels remaining work.
        for (const post of data.posts) {
          if (!active) return;
          if (translated.current[post.id]?.original === post.text) continue;
          try {
            const value = await withRequestDeadline(controller.signal, 24_000, async signal => {
              const language = /[\u4e00-\u9fff]/.test(post.text) && !/[A-Za-z]{4}/.test(post.text) ? "en" : "zh";
              const response = await fetch(`/api/tibo/translate?id=${post.id}&lang=${language}`, { signal });
              const json = await response.json();
              if (!response.ok || typeof json.text !== "string") throw new Error(json.message || "翻译失败");
              return json.text as string;
            });
            if (active) {
              translated.current[post.id] = { original: post.text, text: value };
              setTranslations(current => ({ ...current, [post.id]: { text: value } }));
            }
          } catch (failure) {
            if (active) setTranslations(current => ({ ...current, [post.id]: { error: failure instanceof Error ? failure.message : "翻译失败" } }));
          }
        }
      } catch (failure) {
        if (active) { setError(failure instanceof Error ? failure.message : "网络错误"); setLoading(false); }
      }
    });
    return () => { active = false; controller.abort(); };
  }, [attempt]);

  return <div className="flex h-full flex-col gap-3">
    <div className="flex items-center justify-between gap-2">
      <div><p className="text-sm font-semibold">Tibo · @thsottiaux</p><p className="text-[10px] text-slate-500">公开动态 · 自动中英对照</p></div>
      <button type="button" className="rounded-lg p-2 text-sky-500 hover:bg-sky-500/10" aria-label="刷新Tibo动态" onClick={() => setAttempt(value => value + 1)}><RefreshCw className="h-4 w-4" /></button>
    </div>
    {loading && <p role="status" className="py-4 text-center text-xs text-slate-500">正在读取公开动态…</p>}
    {error && <div role="alert" className="text-xs text-red-500">{error}<button type="button" className="ml-2 underline" onClick={() => setAttempt(value => value + 1)}>重试</button></div>}
    {feed && <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      <p className="text-[10px] text-slate-500">{feed.notice}<br />本次读取：{new Date(feed.checkedAt).toLocaleString("zh-CN")}</p>
      {feed.posts.map(post => <article key={post.id} className="rounded-xl border border-slate-200/60 p-3 dark:border-slate-700/60">
        <time dateTime={post.publishedAt} className="text-[10px] text-slate-500">{new Date(post.publishedAt).toLocaleString("zh-CN")}</time>
        <p className="mt-2 text-[10px] font-semibold text-slate-500">原文</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">{post.text}</p>
        <div className="mt-3 border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
          <p className="text-[10px] font-semibold text-sky-500">中英对照 · 机器翻译</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{translations[post.id]?.text || translations[post.id]?.error || "正在翻译…"}</p>
        </div>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-slate-400 hover:text-sky-500">原帖来源 ↗</a>
      </article>)}
    </div>}
  </div>;
}
