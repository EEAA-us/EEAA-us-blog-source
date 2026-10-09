"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, FolderTree, Loader2 } from "lucide-react";
import ArticleContent from "@/components/ui/ArticleContent";
import PostLikeButton from "@/components/posts/PostLikeButton";
import ReadingProgress from "@/components/ui/ReadingProgress";
import PageCover from "@/components/ui/PageCover";
import ReadingLayoutSettings from "@/components/ui/ReadingLayoutSettings";
import ReadingTextSettings from "@/components/ui/ReadingTextSettings";
import { projects, type ProjectOutlineItem } from "../projectsData";
import { getPosts, getPostBySlug, type PostDetail, type PostItem } from "@/app/api";
import { useTranslation } from "@/lib/i18n";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { recordArticleView } from "@/lib/cloud-stats-client";
import { projectCoverUrl, useProjectCovers } from "@/lib/project-covers";
import { isPublishedContentMode } from "@/lib/published-content";
import { loadPublishedArticle } from "@/lib/published-article";

function OutlineTree({
  items,
  parentId,
  selectedId,
  expandedIds,
  onSelect,
  onPrefetch,
}: {
  items: ProjectOutlineItem[];
  parentId?: string;
  selectedId: string;
  expandedIds: Set<string>;
  onSelect: (id: string, hasChildren: boolean) => void;
  onPrefetch: (slug?: string) => void;
}) {
  const siblings = items.filter((item) => item.parentId === parentId);

  return (
    <ul className={parentId ? "ml-5 mt-1 border-l-2 border-sky-400/35 dark:border-sky-500/30 pl-3 space-y-1" : "space-y-1"}>
      {siblings.map((item) => {
        const hasChildren = items.some((child) => child.parentId === item.id);
        const isExpanded = expandedIds.has(item.id);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id, hasChildren)}
              onMouseEnter={() => onPrefetch(item.slug)}
              onFocus={() => onPrefetch(item.slug)}
              onTouchStart={() => onPrefetch(item.slug)}
              aria-expanded={hasChildren ? isExpanded : undefined}
              className={`w-full flex items-center gap-2 text-left rounded-xl px-3 py-2 text-sm transition-colors ${selectedId === item.id ? "bg-sky-500 text-white shadow-md" : "text-slate-600 dark:text-slate-300 hover:bg-sky-500/10"}`}
            >
              {hasChildren ? <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} /> : <span className="w-3.5 shrink-0" />}
              <span className="truncate">{item.title}</span>
            </button>
            {hasChildren && isExpanded && (
              <OutlineTree
                items={items}
                parentId={item.id}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onPrefetch={onPrefetch}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function ProjectDetailPage() {
  const { tx } = useTranslation();
  const { covers, error: coverError } = useProjectCovers();
  const { preferences, reducedMotion } = useAppearance();
  const params = useParams<{ id: string }>();
  const project = projects.find((item) => item.id === params.id);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selectedId, setSelectedId] = useState("intro");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(["intro"]));
  const [articleResult, setArticleResult] = useState<{ slug: string; data: PostDetail | null } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const positionedProject = useRef<string | null>(null);
  const pendingChapterPosition = useRef(false);
  const viewedArticleIds = useRef(new Set<number>());
  const [copied, setCopied] = useState(false);
  const [articleAttempt, setArticleAttempt] = useState(0);

  useEffect(() => {
    if (!project?.categorySlug) return;
    getPosts({ category: project.categorySlug, status: "published", size: 50 }, { includeStats: false })
      .then(setPosts)
      .catch(() => setPosts([]));
  }, [project]);

  const outline = useMemo(() => {
    return (project?.outline ?? []).map((item) => {
      const post = posts.find((post) => post.slug === item.slug);
      return post ? { ...item, title: post.title, description: post.description } : item;
    });
  }, [project, posts]);

  const selected = outline.find((item) => item.id === selectedId);
  const selectedSlug = selected?.slug;
  const selectedArticle = posts.find((post) => post.slug === selectedSlug);
  const availableChapters = useMemo(() => {
    const seen = new Set<string>();
    return outline.filter((item) => {
      if (!item.slug || seen.has(item.slug)) return false;
      if (!posts.some((post) => post.slug === item.slug && post.status === "published")) return false;
      seen.add(item.slug);
      return true;
    });
  }, [outline, posts]);
  const chapterIndex = selectedSlug ? availableChapters.findIndex((item) => item.slug === selectedSlug) : -1;
  const previousChapter = chapterIndex > 0 ? availableChapters[chapterIndex - 1] : undefined;
  const nextChapter = chapterIndex >= 0 ? availableChapters[chapterIndex + 1] : undefined;
  const article = articleResult && articleResult.slug === selectedSlug ? articleResult.data : null;
  const loading = Boolean(selectedSlug && articleResult?.slug !== selectedSlug);
  const articleError = Boolean(selectedSlug && !loading && !article);
  // Keep the mounted body and reading portals while another chapter downloads.
  // A status identifies the pending chapter; counters/actions still use article.
  const displayedArticle = article ?? (loading ? articleResult?.data : null);
  const content = selectedSlug ? displayedArticle?.content ?? "" : project?.longDescription ?? "";
  const prefetchChapter = (slug?: string) => {
    if (!isPublishedContentMode || !slug || slug === selectedSlug) return;
    const post = posts.find(item => item.slug === slug && item.status === "published");
    if (post) void loadPublishedArticle(post.id).catch(() => {});
  };

  useEffect(() => {
    if (!project || positionedProject.current === project.id || (window.location.hash && window.location.hash !== "#page-content")) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        positionedProject.current = project.id;
        document.getElementById("page-content")?.scrollIntoView({
          block: "start",
          behavior: preferences.navigationScroll === "smooth" && !reducedMotion ? "smooth" : "instant",
        });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [project, preferences.navigationScroll, reducedMotion]);

  const handleOutlineSelect = (id: string, hasChildren: boolean) => {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (id !== selectedId) pendingChapterPosition.current = true;
    setSelectedId(id);
    if (hasChildren) {
      setExpandedIds((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const selectChapter = (item: ProjectOutlineItem) => {
    if (!item.slug || item.slug === selectedSlug) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    pendingChapterPosition.current = true;
    setSelectedId(item.id);
    if (item.parentId) setExpandedIds((previous) => new Set(previous).add(item.parentId!));
  };

  // Commit body and position before painting; a short target must not first
  // clamp the old scroll position and then animate back from that intermediate frame.
  useLayoutEffect(() => {
    if (!pendingChapterPosition.current || loading) return;
    pendingChapterPosition.current = false;
    document.getElementById("page-content")?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }, [selectedId, loading]);

  useEffect(() => {
    if (!selectedSlug) return;
    let active = true;
    getPostBySlug(selectedSlug)
      .then((data) => {
        if (active) setArticleResult({ slug: selectedSlug, data: data.status === "published" ? data : null });
      })
      .catch(() => {
        if (active) setArticleResult({ slug: selectedSlug, data: null });
      });
    return () => { active = false; };
  }, [selectedSlug, articleAttempt]);

  useEffect(() => {
    const viewedArticle = articleResult && articleResult.slug === selectedSlug ? articleResult.data : null;
    const viewedSlug = viewedArticle?.slug;
    const loadedArticleId = viewedArticle?.id;
    if (process.env.NEXT_PUBLIC_CONTENT_MODE !== "published" || !loadedArticleId || viewedArticleIds.current.has(loadedArticleId)) return;
    viewedArticleIds.current.add(loadedArticleId);
    recordArticleView(loadedArticleId).then((stats) => {
      setArticleResult((current) => current && current.slug === viewedSlug && current.data
        ? { ...current, data: { ...current.data, views: stats.views, likes: stats.likes } }
        : current);
    }).catch(() => {});
  }, [articleResult, selectedSlug]);

  const copyArticle = async () => {
    if (!contentRef.current) return;
    await navigator.clipboard.writeText(contentRef.current.innerText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  if (!project) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center">{tx("项目不存在。")}</div>;
  }

  return (
    <div className="relative z-10">
      <PageCover title={project.name} description={project.longDescription} eyebrow="项目文档" image={projectCoverUrl(project.id, project.coverImage, covers)} />
      {coverError && <p role="alert" className="mx-auto max-w-5xl px-4 text-sm text-amber-700 dark:text-amber-300">{coverError}</p>}
      <div id="page-content" className="reading-page relative mx-auto -mt-5 scroll-mt-16 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="editorial-panel detail-breadcrumb mb-5 px-5 py-3 text-slate-500">
        <Link href="/" className="detail-breadcrumb-link hover:text-sky-500">{tx("首页")}</Link><span>/</span>
        <Link href="/projects#page-content" className="detail-breadcrumb-link hover:text-sky-500"><ArrowLeft aria-hidden="true" />{tx("项目")}</Link>
        <span>/</span><span className="text-sky-500">{project.name}</span>
      </div>
      <div className="reading-grid">
        <aside className="reading-project-nav editorial-panel p-5">
          <div className="flex items-center gap-2 mb-4 font-bold text-slate-800 dark:text-white">
            <FolderTree className="w-5 h-5 text-sky-500" />
            <span>{project.name}</span>
          </div>
          <details key={preferences.readingLayout} open={preferences.readingLayout !== "focus"}><summary className="cursor-pointer text-sm font-semibold text-slate-500 mb-2">{tx("文档目录")}</summary>
          <nav aria-label={tx("项目文档目录")}>
            <OutlineTree items={outline} selectedId={selectedId} expandedIds={expandedIds} onSelect={handleOutlineSelect} onPrefetch={prefetchChapter} />
          </nav>
          </details>
        </aside>

        <article aria-busy={loading} className="editorial-panel editorial-reading min-w-0 px-5 py-7 sm:px-10 sm:py-10">
          <ReadingLayoutSettings shortcut />
          <ReadingTextSettings />
          <div className="mb-6 pb-5 border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs uppercase tracking-wider text-sky-500 font-bold">{project.statusLabel}</p>
              <span className="text-xs text-slate-400">{tx("更新于")} {displayedArticle?.updated_at?.slice(0, 10) ?? project.updatedAt}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{displayedArticle?.title ?? selectedArticle?.title ?? selected?.title ?? project.name}</h1>
            <div className="flex items-start justify-between gap-4">
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{displayedArticle?.description ?? selectedArticle?.description ?? selected?.description ?? project.longDescription}</p>
              <button type="button" disabled={loading || articleError} onClick={copyArticle} className="shrink-0 mt-1 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-500 hover:bg-sky-500/20 transition-colors disabled:opacity-50">
                {tx(copied ? "已复制" : "复制全文")}
              </button>
            </div>
          </div>
          {loading && <div role="status" className="mb-4 flex items-center gap-2 text-sm text-sky-500"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />{tx("正在加载文章…")} {selectedArticle?.title ?? selected?.title}</div>}
          {articleError ? (
            <div role="alert" className="py-12 text-center text-slate-500">
              <p>{tx("文章暂时无法加载或尚未发布，请重试。")}</p>
              <button type="button" className="mt-3 text-sky-500 hover:underline" onClick={() => { setArticleResult(null); setArticleAttempt(value => value + 1); }}>{tx("重新加载")}</button>
            </div>
          ) : (
            <>
              <ArticleContent content={content} contentRef={contentRef} imageDimensions={displayedArticle?.image_dimensions} className="project-content" />
              {article && chapterIndex >= 0 && (
                <>
                  <div className="mt-8 border-t border-slate-200/60 pt-5 dark:border-slate-700/60">
                    <PostLikeButton key={article.id} postId={article.id} initialLikes={article.likes} />
                  </div>
                  <nav aria-label={tx("项目章节导航")} className="mt-5 grid grid-cols-2 gap-3">
                    {previousChapter ? (
                      <button type="button" onMouseEnter={() => prefetchChapter(previousChapter.slug)} onFocus={() => prefetchChapter(previousChapter.slug)} onTouchStart={() => prefetchChapter(previousChapter.slug)} onClick={() => selectChapter(previousChapter)} className="group min-w-0 rounded-xl border border-slate-200/70 px-4 py-3 text-left transition-colors hover:border-sky-400/60 hover:bg-sky-500/5 dark:border-slate-700/70">
                        <span className="mb-1 flex items-center gap-1 text-sm text-slate-400"><ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />{tx("上一篇")}</span>
                        <span className="block truncate text-base font-semibold text-slate-700 group-hover:text-sky-500 dark:text-slate-200">{previousChapter.title}</span>
                      </button>
                    ) : <span />}
                    {nextChapter ? (
                      <button type="button" onMouseEnter={() => prefetchChapter(nextChapter.slug)} onFocus={() => prefetchChapter(nextChapter.slug)} onTouchStart={() => prefetchChapter(nextChapter.slug)} onClick={() => selectChapter(nextChapter)} className="group min-w-0 rounded-xl border border-slate-200/70 px-4 py-3 text-right transition-colors hover:border-sky-400/60 hover:bg-sky-500/5 dark:border-slate-700/70">
                        <span className="mb-1 flex items-center justify-end gap-1 text-sm text-slate-400">{tx("下一篇")}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></span>
                        <span className="block truncate text-base font-semibold text-slate-700 group-hover:text-sky-500 dark:text-slate-200">{nextChapter.title}</span>
                      </button>
                    ) : <span />}
                  </nav>
                </>
              )}
            </>
          )}
        </article>

        <div className="reading-outline">
          <ReadingProgress contentRef={contentRef} contentKey={`${content}\0${JSON.stringify(displayedArticle?.image_dimensions ?? {})}`} />
        </div>
      </div>
      </div>
    </div>
  );
}
