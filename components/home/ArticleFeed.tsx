"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen, CalendarDays, Clock, RefreshCw, Search, X } from "lucide-react";
import { getPosts, type PostItem } from "@/app/api";
import { projects } from "@/app/projects/projectsData";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";
import { getArticleCover } from "@/data/article-covers";

export default function ArticleFeed() {
  const { preferences } = useAppearance();
  const { tx } = useTranslation();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const keyword = query.trim();
    const timer = window.setTimeout(() => {
      getPosts({ status: "published", category: category || undefined, search: keyword || undefined, size: keyword ? 4 : 12 }, { includeStats: false })
      .then((data) => { if (active) {
        setPosts(data);
        if (!keyword && !category) setCategories(Array.from(new Set(data.map((post) => post.category).filter(Boolean))));
        setStatus("ready");
      } })
      .catch(() => { if (active) setStatus("error"); });
    }, keyword ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [attempt, category, query]);

  const searching = Boolean(query.trim());
  const visible = posts.slice(0, 4);

  return (
    <section aria-label={tx("最新文章")} className="min-w-0 space-y-4">
      <div className="editorial-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-2.5"><BookOpen className="h-4 w-4 text-sky-500" /><h2 className="font-bold">{tx("最近的记录")}</h2></div>
        <Link href="/posts#page-content" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-500">{tx("全部文章")}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
        {categories.length > 0 && <div aria-label={tx("文章分类")} className="flex w-full flex-wrap gap-2 border-t border-slate-200/50 pt-3 dark:border-white/10">
          {["", ...categories].map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => { setStatus("loading"); setCategory(item); }} className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${category === item ? "theme-primary-button" : "theme-soft-button"}`}>{item || tx("全部")}</button>)}
        </div>}
        <div className="w-full border-t border-slate-200/50 pt-3 dark:border-white/10">
          <label htmlFor="home-article-search" className="mb-2 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold"><Search className="h-3.5 w-3.5 text-sky-500" />{tx("自动搜索")}</span>
            <span>{tx("输入后实时搜索全部文章")}</span>
          </label>
          <div className="relative">
            <input id="home-article-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setStatus("loading"); }} placeholder={tx("搜索标题、正文、分类或标签…")} className="home-feed-search w-full rounded-xl border border-slate-300/25 bg-transparent py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            {query && <button type="button" aria-label={tx("清空文章搜索")} onClick={() => { setQuery(""); setStatus("loading"); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-sky-500/10 hover:text-sky-500"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      </div>
      {status === "loading" && <p role="status" className="editorial-panel p-10 text-center text-sm text-slate-500">{tx("正在加载文章…")}</p>}
      {status === "error" && <div role="alert" className="editorial-panel p-10 text-center text-sm"><p>{tx("暂时无法加载文章")}</p><button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }} className="mt-4 inline-flex items-center gap-2 text-sky-500"><RefreshCw className="h-4 w-4" />{tx("重新加载")}</button></div>}
      {status === "ready" && visible.length === 0 && <p className="editorial-panel p-10 text-center text-sm text-slate-500">{tx("这里还没有已发布的文章。")}</p>}
      {status === "ready" && <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">{searching ? `显示前 ${visible.length} 篇匹配文章，更多结果请进入全部文章` : `只展示最近 ${visible.length} 篇，更多内容请搜索或进入全部文章`}</p>}
      <div className="post-feed-list" data-layout={preferences.layout}>
      {status === "ready" && visible.map((post) => {
        const project = projects.find((item) => item.outline?.some((section) => section.slug === post.slug));
        return <article key={post.id} className="editorial-panel group relative overflow-hidden cursor-pointer">
          <Link
            href={`/posts/${post.slug}`}
            scroll={false}
            aria-label={`${tx("阅读文章：")}${post.title}`}
            className="post-feed-card-link absolute inset-0 z-0 rounded-[inherit]"
          />
          <div className="post-feed-card">
            <div className="pointer-events-none relative z-10 min-w-0 flex-1 p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                {post.category && <span className="theme-secondary-chip rounded-md px-2 py-1">{post.category}</span>}
                {project && <Link href={`/projects/${project.id}#page-content`} scroll={false} className="pointer-events-auto relative z-20 hover:underline">{project.name}</Link>}
              </div>
              <h3 className="text-xl font-bold leading-relaxed tracking-tight transition-colors group-hover:text-sky-500">{post.title}</h3>
              {post.description && <p className="theme-muted mt-3 line-clamp-2 text-sm leading-6">{post.description}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                {post.published_at && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{post.published_at.slice(0, 10)}</span>}
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{post.reading_time} {tx("分钟阅读")}</span>
                <span className="ml-auto inline-flex items-center gap-1 font-medium text-sky-500">{tx("阅读")}<ArrowUpRight className="h-3.5 w-3.5" /></span>
              </div>
            </div>
            <div className="post-feed-cover pointer-events-none relative z-10 block overflow-hidden">
              <Image src={getArticleCover(post)} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
          </div>
        </article>;
      })}
      </div>
    </section>
  );
}
