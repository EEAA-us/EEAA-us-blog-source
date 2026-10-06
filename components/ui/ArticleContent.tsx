"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { renderArticleMarkdown, type ArticleImageDimensions } from "@/lib/article-markdown";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAppearance } from "@/components/providers/AppearanceProvider";

interface ArticleContentProps {
  content: string;
  contentRef: RefObject<HTMLDivElement | null>;
  className?: string;
  imageDimensions?: ArticleImageDimensions;
}

export default function ArticleContent({ content, contentRef, className = "", imageDimensions }: ArticleContentProps) {
  const { tx } = useTranslation();
  const { preferences } = useAppearance();
  const guideRef = useRef<HTMLSpanElement>(null);
  const html = useMemo(() => ({ __html: renderArticleMarkdown(content, imageDimensions) }), [content, imageDimensions]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const root = contentRef.current;
    const guide = guideRef.current;
    if (!root || !guide || (!preferences.articleHoverGuide && !preferences.articleHoverFrame)) return;
    let active: HTMLElement | null = null;
    const update = () => {
      if (!active) return;
      const rect = active.getBoundingClientRect();
      const origin = root.parentElement!.getBoundingClientRect();
      guide.style.top = `${rect.top - origin.top}px`;
      guide.style.left = `${rect.left - origin.left - 8}px`;
      guide.style.width = `${rect.width + 16}px`;
      guide.style.height = `${rect.height}px`;
      guide.style.opacity = "1";
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    const clear = () => {
      if (active) observer.unobserve(active);
      active = null;
      guide.style.opacity = "0";
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !(event.target instanceof HTMLElement)) return;
      let block = event.target;
      while (block.parentElement && block.parentElement !== root) block = block.parentElement;
      if (block.parentElement !== root || !block.matches("p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,table,figure")) { clear(); return; }
      if (active === block) return;
      clear();
      active = block;
      observer.observe(block);
      update();
    };
    root.addEventListener("pointerover", over);
    root.addEventListener("pointerleave", clear);
    window.addEventListener("resize", update);
    window.addEventListener("reading-layout-change", clear);
    return () => {
      observer.disconnect();
      root.removeEventListener("pointerover", over);
      root.removeEventListener("pointerleave", clear);
      window.removeEventListener("resize", update);
      window.removeEventListener("reading-layout-change", clear);
      guide.style.opacity = "0";
    };
  }, [html.__html, contentRef, preferences.articleHoverGuide, preferences.articleHoverFrame]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    let active = true;
    if (root.querySelector("pre code[class*=language-]")) {
      void import("@/lib/article-highlight").then(({ highlightArticleCode }) => {
        if (active) highlightArticleCode(root);
      }).catch(() => { /* Plain code and copying remain usable if the chunk fails. */ });
    }
    const cleanups: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>("pre").forEach((block) => {
      const code = block.querySelector("code");
      if (!code) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-code-button";
      button.textContent = tx("复制");
      let timer: number | undefined;
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(code.textContent ?? "");
          button.textContent = tx("已复制");
        } catch {
          button.textContent = tx("复制失败");
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { button.textContent = tx("复制"); }, 1200);
      };
      button.addEventListener("click", copy);
      block.appendChild(button);
      cleanups.push(() => {
        window.clearTimeout(timer);
        button.removeEventListener("click", copy);
        button.remove();
      });
    });
    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [html.__html, contentRef, tx]);

  return (
    <>
      <style>{`

.article-content ul {
  list-style-type: disc !important;
  padding-left: 1.5rem !important;
  margin: 1rem 0 !important;
}
.article-content ol {
  list-style-type: decimal !important;
  padding-left: 1.5rem !important;
  margin: 1rem 0 !important;
}
.article-content li {
  margin: 0.25rem 0 !important;
  line-height: 1.75 !important;
}
.article-content pre {
  background-color: #1e293b !important;
  color: #e2e8f0 !important;
  padding: 1.25rem !important;
  border-radius: 0.75rem !important;
  overflow-x: auto !important;
  margin: 1.5rem 0 !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace !important;
  line-height: 1.6 !important;
  white-space: pre !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
}
.article-content pre code {
  background-color: transparent !important;
  padding: 0 !important;
  font-size: 0.9em !important;
  white-space: pre !important;
  word-break: normal !important;
  font-family: inherit !important;
}
.article-content code::before, .article-content code::after { content: none !important; }
.article-content p code, .article-content li code {
  background-color: rgba(99,102,241,0.1) !important;
  color: #6366f1 !important;
  padding: 0.15rem 0.4rem !important;
  border-radius: 0.375rem !important;
  font-weight: 600 !important;
  font-size: 0.88em !important;
}
.dark .article-content p code, .dark .article-content li code {
  background-color: rgba(99,102,241,0.2) !important;
  color: #a5b4fc !important;
}
.article-content blockquote {
  border-left: 4px solid #6366f1 !important;
  padding-left: 1rem !important;
  margin: 1.5rem 0 !important;
  color: #475569 !important;
  font-style: normal !important;
  border-radius: 0 .75rem .75rem 0 !important;
  background: rgba(99,102,241,.08) !important;
  padding-top: .65rem !important;
  padding-bottom: .65rem !important;
}
.article-content mark {
  background: rgba(250, 204, 21, .3);
  color: inherit;
  border-radius: .2rem;
  padding: 0 .12rem;
}
.dark .article-content blockquote {
  color: #94a3b8 !important;
}
.article-content img {
  display: block !important;
  margin: 2rem auto !important;
  border-radius: 1rem !important;
  max-width: 100% !important;
  height: auto !important;
  cursor: zoom-in !important;
}
.article-content a {
  color: #6366f1 !important;
  text-decoration: underline !important;
  text-underline-offset: 3px !important;
}
.dark .article-content a {
  color: #818cf8 !important;
}
.article-content h2 {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  margin-top: 2rem !important;
  margin-bottom: 0.75rem !important;
}
.article-content h3 {
  font-size: 1.25rem !important;
  font-weight: 600 !important;
  margin-top: 1.5rem !important;
  margin-bottom: 0.5rem !important;
}
.article-content table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 1.5rem 0 !important;
  border: 2px solid #cbd5e1 !important;
  border-radius: 0.5rem !important;
  overflow: hidden !important;
}
.article-content th, .article-content td {
  border: 1px solid #cbd5e1 !important;
  padding: 0.6rem 1rem !important;
  text-align: left !important;
}
.dark .article-content table {
  border-color: #475569 !important;
}
.dark .article-content th, .dark .article-content td {
  border-color: #475569 !important;
}
.article-content th {
  background-color: #f1f5f9 !important;
  font-weight: 600 !important;
}
.dark .article-content th {
  background-color: #1e293b !important;
}
        .article-content { line-height: 1.85; user-select: text; }
        .article-content p { margin: 1rem 0; }
        .article-content h1, .article-content h2, .article-content h3 { scroll-margin-top: 88px; cursor: pointer; border-left: 4px solid transparent; padding-left: .85rem; transition: background .2s, border-color .2s; }
        .article-content h1 { font-size: 1.8rem; font-weight: 700; margin: 2rem 0 .75rem; }
        .article-reading-body[data-hover-guide="true"] .article-content :is(h1,h2,h3):hover { color: #0ea5e9; }
        .article-reading-body { position: relative; display: flow-root; }
        .article-hover-guide { position: absolute; border: 1px solid transparent; border-radius: 8px;  opacity: 0; pointer-events: none; transition: opacity .12s ease; z-index: 1; }
        .article-reading-body[data-hover-frame="true"] .article-hover-guide { border-style: dashed; border-color: color-mix(in srgb, var(--ui-primary) 45%, transparent); background: color-mix(in srgb, var(--ui-primary) 3%, transparent); }
        .article-reading-body[data-hover-guide="false"] .article-hover-guide::before { display: none; }
        .article-hover-guide::before { content: ""; position: absolute; top: 0; bottom: 0; left: -12px; width: 4px; border-radius: 4px; background: #b4adf5; }
        @media (max-width: 639px) { .article-hover-guide::before { left: -3px; width: 3px; } }
        @media (hover: none), (pointer: coarse) { .article-hover-guide { display: none; } }
        .site-appearance[data-reduce-motion="true"] .article-hover-guide { transition: none; }
        .article-content .article-active-heading { border-left-color: #38bdf8; background: rgba(56,189,248,.12); }
        .article-content pre { position: relative; }
        .article-content .copy-code-button { position: absolute; right: .65rem; top: .55rem; border: 1px solid rgba(148,163,184,.3); border-radius: .45rem; padding: .2rem .55rem; font-size: .7rem; color: #bae6fd; background: rgba(15,23,42,.85); cursor: pointer; }
      `}</style>
      <div className="article-reading-body" data-hover-guide={preferences.articleHoverGuide} data-hover-frame={preferences.articleHoverFrame}>
      <span ref={guideRef} className="article-hover-guide" aria-hidden="true" />
      <div
        ref={contentRef}
        className={`article-content max-w-none text-slate-800 dark:text-slate-200 ${className}`}
        onClick={(event) => {
          if (event.target instanceof HTMLImageElement) setLightboxSrc(event.target.src);
        }}
        dangerouslySetInnerHTML={html}
      />
      </div>
      {lightboxSrc && (
        <div role="dialog" aria-modal="true" aria-label={tx("图片预览")} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={() => setLightboxSrc(null)}>
          <button type="button" aria-label={tx("关闭图片预览")} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" onClick={() => setLightboxSrc(null)}><X className="w-6 h-6" /></button>
          <div role="img" aria-label={tx("文章图片放大预览")} className="w-[95vw] h-[90vh] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(lightboxSrc)})` }} />
        </div>
      )}
    </>
  );
}
