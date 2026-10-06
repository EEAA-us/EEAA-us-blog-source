"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";

import { useArticleHeadings } from "./useArticleHeadings";
import ArticleOutline from "./ArticleOutline";
import { useTranslation } from "@/lib/i18n";

interface ReadingProgressProps {
  contentRef: React.RefObject<HTMLElement | null>;
  contentKey: string;
}

export default function ReadingProgress({ contentRef, contentKey }: ReadingProgressProps) {
  const { tx } = useTranslation();
  const progressRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { headings, activeId, scrollToHeading } = useArticleHeadings(contentRef, contentKey);

  // 监听滚动
  useEffect(() => {
    let frame: number | null = null;
    let docHeight = 0;
    const updateProgress = () => {
      frame = null;
      const scrollTop = window.scrollY;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.max(0, Math.min(scrollPercent, 100)) / 100})`;
      setShowBackToTop(scrollTop > 300);
    };
    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateProgress);
    };
    const onResize = () => {
      docHeight = document.documentElement.scrollHeight - window.innerHeight;
      scheduleUpdate();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(document.body);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", onResize);
    };
  }, [contentKey]);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || Boolean(contentRef.current?.closest('[data-reduce-motion="true"]'));
    document.getElementById("page-content")?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
  };

  return (
    <>
      {/* 阅读进度条 */}
      <div className="fixed top-0 left-0 w-full h-1 z-50">
        <div
          ref={progressRef}
          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500"
          style={{ transform: "scaleX(0)", transformOrigin: "left" }}
        />
      </div>

      {headings.length > 0 && (
        <aside className="editorial-panel p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" aria-label={tx("文章本页目录")}>
          <h3 className="mb-4 text-base font-bold">{tx("本页目录")}</h3>
          <nav className="max-h-44 overflow-y-auto text-sm lg:max-h-none lg:overflow-visible">
            <ArticleOutline headings={headings} activeId={activeId} onSelect={scrollToHeading} />
          </nav>
        </aside>
      )}

      {/* 回到顶部按钮 */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed right-4 bottom-12 z-[10002] md:right-6 md:bottom-24"
          >
            <button
              type="button"
              onClick={scrollToTop}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-all"
              title={tx("回到文章顶部")}
              aria-label={tx("回到文章顶部")}
            >
              <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
