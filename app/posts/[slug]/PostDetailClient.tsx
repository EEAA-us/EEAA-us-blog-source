"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Eye,
  FolderGit2,
  Loader2,
} from "lucide-react";
import { getPostBySlug, type PostDetail } from "@/app/api";
import ReadingProgress from "@/components/ui/ReadingProgress";
import ArticleContent from "@/components/ui/ArticleContent";
import { projects } from "@/app/projects/projectsData";
import PageCover from "@/components/ui/PageCover";
import ReadingLayoutSettings from "@/components/ui/ReadingLayoutSettings";
import ReadingTextSettings from "@/components/ui/ReadingTextSettings";
import ArticleReadingSidebar from "@/components/posts/ArticleReadingSidebar";
import ArticleReturnLink from "@/components/posts/ArticleReturnLink";
import PostLikeButton from "@/components/posts/PostLikeButton";
import { useTranslation } from "@/lib/i18n";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { recordArticleView } from "@/lib/cloud-stats-client";

export default function PostDetailPage({ initialPost }: { initialPost?: PostDetail }) {
  const { tx, language } = useTranslation();
  const { preferences, reducedMotion } = useAppearance();
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostDetail | null>(initialPost ?? null);
  const [loading, setLoading] = useState(!initialPost);
  const [error, setError] = useState(false);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const positionedSlug = useRef<string | null>(null);

  useEffect(() => {
    if (!slug || initialPost || process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return;
    let active = true;
    getPostBySlug(slug)
      .then((data) => {
        if (active) {
          setPost(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [slug, initialPost]);

  const postId = post?.id;
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CONTENT_MODE !== "published" || !postId) return;
    let active = true;
    recordArticleView(postId).then((stats) => {
      if (active) setPost((current) => current ? { ...current, views: stats.views, likes: stats.likes } : current);
    }).catch(() => {
      if (active) setStatsUnavailable(true);
    });
    return () => { active = false; };
  }, [postId]);

  useEffect(() => {
    if (!post || positionedSlug.current === post.slug || (window.location.hash && window.location.hash !== "#page-content")) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        positionedSlug.current = post.slug;
        document.getElementById("page-content")?.scrollIntoView({ block: "start", behavior: preferences.navigationScroll === "smooth" && !reducedMotion ? "smooth" : "instant" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [post, preferences.navigationScroll, reducedMotion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-12">
        <ArticleReturnLink footer />
        <div className="flex flex-col items-center justify-center py-20 md:py-32 text-slate-400">
          <p className="text-base md:text-lg">{tx("文章不存在或已被删除")}</p>
        </div>
      </div>
    );
  }

  const relatedProjects = projects.filter((project) => project.outline?.some((item) => item.slug === post.slug));
  const dateStr = post.published_at
    ? new Date(post.published_at).toLocaleDateString(language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

  return (
    <div className="relative z-10">
      <PageCover title={post.title} description={post.description} eyebrow={post.category || "一篇新的记录"} />
      <div id="page-content" className="reading-page relative mx-auto -mt-5 scroll-mt-16 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="editorial-panel detail-breadcrumb mb-5 px-5 py-3 text-slate-500">
          <Link href="/" className="detail-breadcrumb-link hover:text-sky-500">{tx("首页")}</Link><span>/</span>
          <ArticleReturnLink />
          {post.category && <><span>/</span>{relatedProjects[0] ? <Link href={`/projects/${relatedProjects[0].id}#page-content`} className="detail-breadcrumb-link hover:text-sky-500">{post.category}</Link> : <span>{post.category}</span>}</>}
          <span>/</span><span className="text-sky-500" aria-current="page">{post.title}</span>
        </div>
      <div className="reading-grid">
          <div className="reading-utility">
            <ArticleReadingSidebar />
          </div>
          <article className="editorial-panel editorial-reading min-w-0 px-5 py-7 sm:px-10 sm:py-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 pb-5 sm:mb-8 sm:pb-8 border-b border-slate-200/60 dark:border-white/10">
            {dateStr && (
              <span className="flex items-center gap-1 sm:gap-1.5">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {dateStr}
              </span>
            )}
            <span className="flex items-center gap-1 sm:gap-1.5">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {post.reading_time} {tx("分钟阅读")}
            </span>
            <span className="flex items-center gap-1 sm:gap-1.5">
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {post.views} {tx("次浏览")}{statsUnavailable ? ` · ${tx("统计暂不可用")}` : ""}
            </span>
            {relatedProjects.length > 0 && (
              <div aria-label={tx("所属项目")} className="flex w-full flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <FolderGit2 aria-hidden="true" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {tx("所属项目")}
                </span>
                {relatedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 font-medium text-sky-600 transition-colors hover:bg-sky-500/20 dark:text-sky-400"
                  >
                    {project.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

            <ReadingLayoutSettings shortcut />
            <ReadingTextSettings />
              <ArticleContent content={post.content} contentRef={contentRef} imageDimensions={post.image_dimensions} className="post-content" />
            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-6 text-xs text-slate-500 dark:border-white/10">
              <PostLikeButton key={post.id} postId={post.id} initialLikes={post.likes} />
              <span>{tx("感谢阅读，愿这些记录对你有所帮助。")}</span>
              <ArticleReturnLink footer />
            </footer>
          </article>
          <div className="reading-outline">
            <ReadingProgress key={post.slug} contentRef={contentRef} contentKey={`${post.content}\0${JSON.stringify(post.image_dimensions ?? {})}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
