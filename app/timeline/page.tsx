"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Clock3, Eye } from "lucide-react";
import { getPosts, type PostItem } from "@/app/api";
import PageCover from "@/components/ui/PageCover";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";
import "./archive.css";

type ViewMode = "horizontal" | "vertical";
type LoadState = "loading" | "ready" | "error";

function postDate(post: PostItem) {
  return new Date(post.published_at || post.created_at);
}

function ArticleMeta({ post }: { post: PostItem }) {
  const { tx, language } = useTranslation();
  return (
    <div className="archive-meta">
      <span className="archive-category">{post.category || tx("随记")}</span>
      <span><Clock3 aria-hidden="true" />{post.reading_time} {tx("分钟")}</span>
      <span><Eye aria-hidden="true" />{post.views} {language === "zh" ? "次浏览" : tx("次浏览")}</span>
    </div>
  );
}

function ArchiveCard({ post, index, href, onOpen }: { post: PostItem; index: number; href: string; onOpen: () => void }) {
  const date = postDate(post);
  const { language } = useTranslation();
  const locale = language === "en" ? "en-US" : language === "ja" ? "ja-JP" : "zh-CN";
  return (
    <Link href={href} onClick={onOpen} className="archive-card" id={`archive-post-${post.id}`}>
      <span className="archive-card-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="archive-card-date" aria-label={date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}>
        <span>{String(date.getDate()).padStart(2, "0")}</span>
        <small>{date.toLocaleDateString("zh-CN", { month: "long" })}</small>
      </div>
      <h3>{post.title}</h3>
      <p className="archive-card-description">{post.description || "打开这篇文章，继续阅读完整内容。"}</p>
      <ArticleMeta post={post} />
    </Link>
  );
}

async function loadAllPosts() {
  const posts: PostItem[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await getPosts({ status: "published", page, size: 200 });
    posts.push(...batch);
    if (batch.length < 200) return posts;
  }
}

export default function TimelinePage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewMode>("horizontal");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useAppearance();
  const { tx, language } = useTranslation();
  const locale = language === "en" ? "en-US" : language === "ja" ? "ja-JP" : "zh-CN";
  const restored = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setView(params.get("view") === "vertical" ? "vertical" : "horizontal");
      const year = params.get("year");
      setSelectedYear(year && /^\d{4}$/.test(year) ? Number(year) : null);
    });
  }, []);

  useEffect(() => {
    if (status !== "ready" || restored.current) return;
    restored.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("restore") !== "1") return;
    let state: { post?: number; view?: string; year?: number | null; top?: number; left?: number } | null = null;
    try { state = JSON.parse(sessionStorage.getItem("archive-return-state") || "null"); } catch { /* The URL still identifies the article if storage is unavailable. */ }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (state?.post === Number(params.get("post")) && state?.view === view && state?.year === selectedYear && typeof state.top === "number" && Number.isFinite(state.top)) {
          if (scrollerRef.current) scrollerRef.current.scrollLeft = typeof state.left === "number" && Number.isFinite(state.left) ? state.left : 0;
          window.scrollTo({ top: Math.max(0, state.top), behavior: "instant" });
        } else {
          const postId = params.get("post");
          const target = postId && /^\d+$/.test(postId) ? document.getElementById(`archive-post-${postId}`) : null;
          (target ?? document.getElementById("page-content"))?.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [status, view, selectedYear]);

  const articleHref = (post: PostItem) => {
    const params = new URLSearchParams({ from: "archive", archiveView: view, archivePost: String(post.id) });
    if (selectedYear !== null) params.set("archiveYear", String(selectedYear));
    return `/posts/${post.slug}?${params}#page-content`;
  };
  const rememberPosition = (post: PostItem) => {
    try { sessionStorage.setItem("archive-return-state", JSON.stringify({ post: post.id, view, year: selectedYear, top: window.scrollY, left: scrollerRef.current?.scrollLeft ?? 0 })); } catch { /* Navigation works without browser storage. */ }
  };

  useEffect(() => {
    let active = true;
    loadAllPosts()
      .then((items) => { if (active) { setPosts(items); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [attempt]);

  const sorted = useMemo(
    () => [...posts].sort((a, b) => postDate(b).getTime() - postDate(a).getTime()),
    [posts],
  );
  const years = useMemo(() => {
    const groups = new Map<number, PostItem[]>();
    for (const post of sorted) {
      const year = postDate(post).getFullYear();
      groups.set(year, [...(groups.get(year) || []), post]);
    }
    return [...groups.entries()];
  }, [sorted]);
  const filtered = useMemo(
    () => selectedYear === null ? sorted : sorted.filter((post) => postDate(post).getFullYear() === selectedYear),
    [selectedYear, sorted],
  );
  const yearsCount = years.length;
  const newestDate = sorted[0] ? postDate(sorted[0]) : null;
  const chooseYear = (year: number | null) => {
    setSelectedYear(year);
    scrollerRef.current?.scrollTo({ left: 0, behavior: "instant" });
  };
  const move = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * Math.max(300, scroller.clientWidth * 0.75), behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <>
      <PageCover title="归档" description="沿着时间，重读写下的故事" eyebrow="时间 · 文章 · 足迹" />
      <main id="page-content" className="archive-page relative z-10 mx-auto max-w-[1536px] px-4 py-8 pb-24 sm:px-6 md:py-12 lg:px-8">
        <header className="archive-summary">
          <div className="archive-summary-copy">
            <p className="archive-eyebrow">ARCHIVE <span>{tx("文章年册")}</span></p>
            <h2>{tx("文章归档")}</h2>
            <p className="archive-summary-stats">
              {status === "ready" ? <><strong>{sorted.length}</strong> {language === "zh" ? "篇文章" : language === "en" ? "articles" : "件の記事"} <i /> <strong>{years.length > 1 ? `${years[years.length - 1][0]}–${years[0][0]}` : years[0]?.[0] ?? "—"}</strong> {language === "zh" ? "年" : ""} <i /> {language === "zh" ? "最新发布" : language === "en" ? "Latest" : "最新"} <strong>{newestDate ? newestDate.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "—"}</strong></> : tx("按发布时间，从新到旧整理已发布文章。")}
            </p>
          </div>
          <div role="group" aria-label={tx("归档显示方式")} className="archive-view-switch">
            <button type="button" aria-pressed={view === "horizontal"} onClick={() => setView("horizontal")}><ArrowRight aria-hidden="true" />{tx("横向时间线")}</button>
            <button type="button" aria-pressed={view === "vertical"} onClick={() => setView("vertical")}><ArrowDown aria-hidden="true" />{tx("按年份浏览")}</button>
          </div>
        </header>

        {status === "ready" && sorted.length > 0 && <nav aria-label={tx("按年份筛选")} className="archive-year-filters">
          {yearsCount > 1 && <button type="button" aria-pressed={selectedYear === null} onClick={() => chooseYear(null)}>{tx("全部年份")}</button>}
          {years.map(([year, items]) => yearsCount === 1 ? <span className="archive-year-label" key={year}>{year}<small>{items.length} 篇</small></span> : <button type="button" key={year} aria-pressed={selectedYear === year} onClick={() => chooseYear(year)}>{year}<span>{items.length}</span></button>)}
        </nav>}

        {status === "loading" && <div role="status" className="archive-message">{tx("正在整理文章时间线…")}</div>}
        {status === "error" && <div role="alert" className="archive-message archive-message-error"><p>{tx("暂时无法加载归档。")} </p><button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>{tx("重新加载")}</button></div>}
        {status === "ready" && sorted.length === 0 && <div className="archive-message"><BookOpen aria-hidden="true" /><p>{tx("还没有已发布的文章。")}</p></div>}

        {status === "ready" && filtered.length > 0 && view === "horizontal" && <section aria-label={tx("横向文章时间线")} className="archive-horizontal">
          <div className="archive-scroll-tools"><p>{selectedYear ?? (yearsCount === 1 ? years[0][0] : tx("全部年份"))} <span>·</span> {filtered.length} {language === "zh" ? "篇文章" : language === "en" ? "articles" : "件の記事"} <span className="archive-scroll-hint">{tx("向左滑动可查看更早的文章")}</span></p><div>
            <button type="button" onClick={() => move(-1)} aria-label={tx("向左查看较新的文章")}><ArrowLeft aria-hidden="true" /></button>
            <button type="button" onClick={() => move(1)} aria-label={tx("向右查看较早的文章")}><ArrowRight aria-hidden="true" /></button>
          </div></div>
          <div ref={scrollerRef} tabIndex={0} role="region" aria-label={tx("横向归档文章列表")} className="archive-scroller">
            <ol>{filtered.map((post) => <li key={post.id}><div className="archive-track-date"><span /><time dateTime={post.published_at || post.created_at}>{postDate(post).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</time></div><ArchiveCard post={post} index={sorted.indexOf(post)} href={articleHref(post)} onOpen={() => rememberPosition(post)} /></li>)}</ol>
          </div>
        </section>}

        {status === "ready" && filtered.length > 0 && view === "vertical" && <div className="archive-years">
          {years.filter(([year]) => selectedYear === null || selectedYear === year).map(([year, items]) => {
            const monthGroups = new Map<number, PostItem[]>();
            for (const post of items) {
              const month = postDate(post).getMonth();
              monthGroups.set(month, [...(monthGroups.get(month) || []), post]);
            }
            return <section className="archive-year-section" key={year} aria-labelledby={`archive-year-${year}`}>
              <header><h3 id={`archive-year-${year}`}>{year}</h3><span>{items.length} {language === "zh" ? "篇" : language === "en" ? "articles" : "件"}</span></header>
              <div className="archive-month-groups">{[...monthGroups.entries()].map(([month, monthPosts]) => <section className="archive-month" key={month} aria-label={`${month + 1}月`}>
                <h4>{String(month + 1).padStart(2, "0")} <span>月</span></h4>
                <ol>{monthPosts.map((post) => <li key={post.id}>
                  <Link href={articleHref(post)} onClick={() => rememberPosition(post)} className="archive-row" id={`archive-post-${post.id}`}>
                    <time dateTime={post.published_at || post.created_at}>{postDate(post).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}</time>
                    <div className="archive-row-copy"><h5>{post.title}</h5><p>{post.description || "打开这篇文章，继续阅读完整内容。"}</p><ArticleMeta post={post} /></div>
                    <span className="archive-row-index">{String(sorted.indexOf(post) + 1).padStart(2, "0")}</span>
                  </Link>
                </li>)}</ol>
              </section>)}</div>
            </section>;
          })}
        </div>}
      </main>
    </>
  );
}
