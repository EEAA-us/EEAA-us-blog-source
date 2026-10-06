"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { getPosts, type PostItem } from "@/app/api";
import { useTranslation } from "@/lib/i18n";

export default function ArticleSearch() {
  const { tx } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const keyword = query.trim();
    const load = async () => {
      try {
        const collected = await getPosts({ status: "published", search: keyword || undefined, page: 1, size: 100 }, { includeStats: false });
        if (active) {
          setPosts(collected.filter((post) => post.status === "published"));
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    };
    const timer = window.setTimeout(() => void load(), keyword ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, query, attempt]);

  const close = () => dialogRef.current?.close();
  const hasQuery = Boolean(query.trim());

  return (
    <>
      <button type="button" aria-label={tx("搜索文章")} title={tx("搜索文章")} onClick={() => { setQuery(""); setStatus("loading"); setOpen(true); dialogRef.current?.showModal(); inputRef.current?.focus({ preventScroll: true }); }} className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100/50 dark:text-slate-400 dark:hover:bg-slate-800/50"><Search className="h-5 w-5" /></button>
      <dialog ref={dialogRef} aria-labelledby="article-search-title" onClose={() => setOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="article-search-dialog">
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-4"><h2 id="article-search-title" className="text-lg font-semibold">{tx("搜索文章")}</h2><button type="button" aria-label={tx("关闭搜索")} onClick={close} className="rounded-lg p-2 hover:bg-sky-500/10"><X className="h-5 w-5" /></button></div>
          <label htmlFor="article-search-input" className="sr-only">{tx("文章关键词")}</label>
          <input ref={inputRef} id="article-search-input" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setStatus("loading"); }} placeholder={tx("搜索标题、正文、分类或标签…")} className="w-full rounded-xl border border-slate-300/40 bg-transparent px-4 py-3 text-base outline-none focus:ring-2 focus:ring-sky-500" />
          <p className="mt-3 text-xs leading-6 opacity-65">{tx("搜索全部已发布文章，正文里的 STM32 术语和代码也能找到。")}</p>
          <div className="mt-5 max-h-[50svh] overflow-y-auto overscroll-contain" aria-live="polite" aria-busy={status === "loading"}>
            {status === "loading" && <p role="status" className="py-8 text-center text-sm">{tx("正在加载文章索引…")}</p>}
            {status === "error" && <div role="alert" className="py-8 text-center text-sm"><p>{tx("暂时无法搜索文章，请重试。")}</p><button type="button" className="mt-3 text-sky-500" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>{tx("重新加载搜索")}</button></div>}
            {status === "ready" && <><p className="mb-3 text-xs opacity-65">{tx(hasQuery ? "找到 {n} 篇文章" : "最近 {n} 篇文章", { n: posts.length })}</p>{posts.length ? <ul className="space-y-2">{posts.map((post) => <li key={post.id}><Link href={`/posts/${post.slug}`} onClick={close} className="block rounded-xl border border-slate-300/15 p-4 transition-colors hover:bg-sky-500/10"><span className="block text-base font-semibold">{post.title}</span><span className="mt-2 block line-clamp-2 text-sm leading-6 opacity-70">{post.description || post.category || tx("阅读文章")}</span></Link></li>)}</ul> : <p className="py-8 text-center text-sm">{tx("没有找到匹配的文章，试试其他关键词。")}</p>}</>}
          </div>
        </div>
      </dialog>
    </>
  );
}


