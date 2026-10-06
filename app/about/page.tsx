import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { load as loadYaml } from "js-yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import rehypeExternalLinks from "@/lib/rehype-external-links";
import "highlight.js/styles/atom-one-dark.css";
import { siteConfig } from "@/siteConfig";
import FadeIn from "@/components/ui/FadeIn";
import PageCover from "@/components/ui/PageCover";
import AboutHeading from "@/components/ui/AboutHeading";
import AnimatedAvatar from "@/components/ui/AnimatedAvatar";

export default async function AboutPage() {
  const fullPath = path.join(process.cwd(), "app", "about", "about.md");
  let contentHtml = "博主很懒，还没有写自我介绍哦...";
  let coverImage = siteConfig.heroImage;

  try {
    const fileContents = fs.readFileSync(fullPath, "utf8");
    // gray-matter's original YAML engine uses the obsolete safeLoad API.
    const { data, content } = matter(fileContents, { engines: { yaml: (input) => {
      const metadata = loadYaml(input);
      if (metadata == null) return {};
      if (typeof metadata !== "object" || Array.isArray(metadata)) throw new TypeError("About metadata must be a YAML mapping");
      return metadata as Record<string, unknown>;
    } } });

    if (data.cover) coverImage = data.cover;

    const processedContent = await unified()
      .use(remarkParse)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeHighlight)
      .use(rehypeExternalLinks)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(content);

    contentHtml = processedContent.toString();
  } catch (e) {
    console.error("读取 about.md 失败", e);
  }

  return (
    <>
      <PageCover title="关于" description={`Hello World, I'm ${siteConfig.authorName}`} eyebrow="记录 · 分享 · 相遇" />
      <div id="page-content">
      <FadeIn className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <div className="editorial-panel overflow-hidden">

        {/* 封面大图 */}
        <div className="w-full h-36 md:h-64 relative bg-slate-200 dark:bg-slate-700 overflow-hidden group">
          <img
            src={coverImage}
            alt="关于小站的封面插画"
            className="w-full h-full object-cover object-[68%_28%] transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
        </div>

        <div className="px-4 md:px-16 pb-8 md:pb-16 relative">
          {/* 头像 */}
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden -mt-12 md:-mt-16 relative z-20 bg-white">
            <AnimatedAvatar sizes="(min-width: 768px) 128px, 96px" />
          </div>

          {/* 标题区 */}
          <div className="mt-4 md:mt-6 mb-5 md:mb-8 border-b border-slate-300/50 dark:border-slate-700 pb-5 md:pb-8">
            <AboutHeading />
          </div>

          {/* Markdown 正文 */}
          <div className="relative">
            <style>{`
              .prose pre {
                background-color: #282c34 !important;
                color: #abb2bf !important;
                padding: 1.25rem !important;
                border-radius: 0.75rem !important;
                overflow-x: auto !important;
                box-shadow: inset 0 0 10px rgba(0,0,0,0.3) !important;
                margin-top: 1.5rem !important;
                margin-bottom: 1.5rem !important;
              }
              .prose pre code {
                background-color: transparent !important;
                padding: 0 !important;
                color: inherit !important;
                font-size: 0.9em !important;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
              }
              .prose code::before, .prose code::after { content: none !important; }
              .prose p code, .prose li code {
                background-color: rgba(99, 102, 241, 0.1) !important;
                color: #6366f1 !important;
                padding: 0.2rem 0.4rem !important;
                border-radius: 0.375rem !important;
                font-weight: 600 !important;
              }
              .dark .prose p code, .dark .prose li code {
                background-color: rgba(99, 102, 241, 0.2) !important;
                color: #818cf8 !important;
              }
              .prose h2 {
                font-size: 1.75rem !important;
                font-weight: 800 !important;
                margin-bottom: 1rem !important;
                margin-top: 2.5rem !important;
                color: inherit !important;
              }
              .prose h3 {
                font-size: 1.25rem !important;
                font-weight: 700 !important;
                margin-bottom: 0.75rem !important;
                color: inherit !important;
              }
              .prose p {
                font-size: 1.05rem !important;
                line-height: 1.85 !important;
                color: inherit !important;
              }
              .prose .about-greeting {
                font-size: clamp(1.35rem, 2.8vw, 2rem) !important;
                font-weight: 800 !important;
                color: var(--ui-primary) !important;
                line-height: 1.6 !important;
              }
              .prose ul {
                list-style-type: disc !important;
                padding-left: 1.5rem !important;
              }
              .prose blockquote {
                border-left: 4px solid #6366f1 !important;
                padding-left: 1rem !important;
                margin: 1.5rem 0 !important;
                color: #64748b !important;
                font-style: italic !important;
              }
              .dark .prose blockquote {
                color: #94a3b8 !important;
              }
              .prose img {
                display: block !important;
                margin: 2rem auto !important;
                border-radius: 1.5rem !important;
                box-shadow: 0 20px 50px rgba(0,0,0,0.15) !important;
                max-width: 100% !important;
                height: auto !important;
              }
              .prose a {
                color: #6366f1 !important;
                text-decoration: underline !important;
                text-underline-offset: 3px !important;
              }
              .dark .prose a {
                color: #818cf8 !important;
              }
              .prose strong {
                color: inherit !important;
                font-weight: 700 !important;
              }
            `}</style>

            <div
              className="prose prose-sm md:prose-lg prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 transition-colors duration-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
        </div>
      </div>
      </FadeIn>
      </div>
    </>
  );
}
