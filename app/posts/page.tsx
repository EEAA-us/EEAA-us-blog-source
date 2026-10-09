"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, Search, X } from "lucide-react";
import PostCard, { type PostOut } from "@/components/posts/PostCard";
import { getCategories, getPosts, getPostsCount, refreshPublishedStats, type CategoryItem } from "@/app/api";
import PageCover from "@/components/ui/PageCover";
import { useTranslation } from "@/lib/i18n";

export default function PostsPage() {
  const { tx, language } = useTranslation();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const pageSize = 12;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    const nextQuery = searchInput.trim();
    if (nextQuery === searchQuery) return;
    const timer = window.setTimeout(() => {
      setSearchQuery(nextQuery);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    if (window.location.hash !== "#page-content") return;
    const scrollToContent = () => document.getElementById("page-content")?.scrollIntoView({ block: "start" });
    const frame = requestAnimationFrame(scrollToContent);
    const timer = window.setTimeout(scrollToContent, 80);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);

  // 获取分类
  useEffect(() => {
    getCategories()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.sort - b.sort);
        setCategories(sorted);
      })
      .catch(() => {});
  }, []);

  // 列表与总数使用同一组筛选条件，避免页码指向空结果。
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) { setLoading(true); setError(false); }
    });
    const filters = {
      status: "published",
      page,
      size: pageSize,
      ...(activeCategory ? { category: activeCategory } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
    };
    Promise.all([
      getPosts(filters, { includeStats: false }),
      getPostsCount("published", { category: activeCategory ?? undefined, search: searchQuery || undefined }),
    ])
      .then(([data, count]) => {
        if (!active) return;
        setPosts(data);
        setTotalCount(count.count);
        // Content is ready independently of the optional live counters.
        setLoading(false);
        void refreshPublishedStats(data).then((updated) => {
          if (active) setPosts(updated);
        }).catch(() => { /* The snapshot counters remain available. */ });
      })
      .catch(() => {
        if (active) { setPosts([]); setTotalCount(0); setError(true); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeCategory, page, searchQuery, retryKey]);

  const selectPage = (next: number) => {
    if (next === page || next < 1 || next > totalPages) return;
    setPage(next);
    document.getElementById("posts-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pageItems: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  if (totalPages > 0) {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    if (start > 1) pageItems.push(1);
    if (start > 2) pageItems.push("ellipsis-start");
    for (let number = start; number <= end; number++) pageItems.push(number);
    if (end < totalPages - 1) pageItems.push("ellipsis-end");
    if (end < totalPages) pageItems.push(totalPages);
  }

  return (
    <div className="relative z-10">
      <PageCover title="文章" description="记录技术探索、学术研究与生活感悟" eyebrow="学习 · 生活 · 灵感" />
      <div id="page-content" className="relative mx-auto -mt-5 max-w-6xl scroll-mt-16 px-4 py-6 sm:px-6 md:py-12 lg:px-8">
      {/* 页头 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-10"
      >
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <BookOpen className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
          <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
            {tx("文章")}
          </h1>
        </div>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 ml-7 md:ml-10">
          {tx("记录技术探索、学术研究与生活感悟")}
        </p>
      </motion.div>

      <div className="relative mb-5 max-w-xl md:mb-7">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          maxLength={100}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={tx("搜索标题、正文、分类或标签")}
          aria-label={tx("搜索文章")}
          className="w-full rounded-2xl border border-white/40 bg-white/55 py-3 pl-11 pr-11 text-sm text-slate-800 shadow-sm outline-none backdrop-blur-md placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-800/65 dark:text-slate-100"
        />
        {searchInput && <button type="button" onClick={() => setSearchInput("")} aria-label={tx("清空搜索")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-sky-500"><X className="h-4 w-4" /></button>}
      </div>

      {/* 分类筛选 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-5 md:mb-8 flex flex-wrap gap-1.5 md:gap-2"
      >
        <FilterTab
          label={tx("全部")}
          count={null}
          active={activeCategory === null}
          onClick={() => { setActiveCategory(null); setPage(1); }}
        />
        {categories.map((cat) => (
          <FilterTab
            key={cat.id}
            label={cat.name}
            count={cat.post_count}
            active={activeCategory === cat.slug}
            onClick={() => { setActiveCategory(cat.slug); setPage(1); }}
          />
        ))}
      </motion.div>

      <div id="posts-results" className="scroll-mt-24" />
      {error ? (
        <div role="alert" className="py-24 text-center text-sm text-slate-500">
          {tx("文章暂时无法加载。")}<button type="button" onClick={() => setRetryKey((key) => key + 1)} className="ml-2 text-sky-500 hover:underline">{tx("重试")}</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <BookOpen className="w-12 h-12 mb-4 opacity-40" />
          <p>{tx(searchQuery ? "没有找到相关文章" : "暂无文章")}</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory ?? "all"}-${searchQuery}-${page}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
          >
            {posts.map((post, i) => (
              <div key={post.id}>
                <PostCard post={post} index={i} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && !error && totalPages > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">{language === "zh" ? `共 ${totalCount} 篇 · 第 ${page} / ${totalPages} 页` : language === "en" ? `${totalCount} articles · Page ${page} of ${totalPages}` : `${totalCount} 件 · ${page} / ${totalPages} ページ`}</p>
          <nav aria-label={tx("文章分页")} className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => selectPage(page - 1)} disabled={page === 1} className="rounded-xl border border-white/40 bg-white/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-800/50">{tx("上一页")}</button>
            {pageItems.map((item) => typeof item === "number" ? (
              <button key={item} type="button" onClick={() => selectPage(item)} aria-label={language === "zh" ? `第 ${item} 页` : language === "en" ? `Page ${item}` : `${item}ページ`} aria-current={item === page ? "page" : undefined} className={`min-w-10 rounded-xl border px-3 py-2 text-sm ${item === page ? "border-sky-500 bg-sky-500 text-white" : "border-white/40 bg-white/40 text-slate-700 hover:border-sky-400 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-200"}`}>{item}</button>
            ) : <span key={item} aria-hidden="true" className="px-1 text-slate-400">…</span>)}
            <button type="button" onClick={() => selectPage(page + 1)} disabled={page === totalPages} className="rounded-xl border border-white/40 bg-white/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-800/50">{tx("下一页")}</button>
          </nav>
        </div>
      )}
      </div>
    </div>
  );
}

/* ---------- 分类标签组件 ---------- */

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-1.5 md:px-5 md:py-2 rounded-2xl text-xs md:text-sm font-medium transition-all duration-300 ${
        active
          ? "text-white shadow-lg shadow-sky-500/20"
          : "text-slate-600 dark:text-slate-400 bg-white/10 dark:bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/20 dark:hover:bg-white/[0.1]"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeCategoryBg"
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">
        {label}
        {count !== null && count > 0 && (
          <span
            className={`ml-1.5 text-xs ${
              active ? "text-white/70" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}
