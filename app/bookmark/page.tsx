"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ExternalLink, GitBranch, Shapes } from "lucide-react";
import { getBookmarks } from "@/app/api";
import type { BookmarkSite } from "@/app/api";
import PageCover from "@/components/ui/PageCover";
import { useTranslation } from "@/lib/i18n";
import {
  curatedBookmarkCategories,
  mergeBookmarkCategories,
  type CuratedBookmarkCategory,
} from "@/data/bookmarks";

/** Prefer the locally cached official icon; backend entries may still use their own icon or favicon. */
function getIcon(site: BookmarkSite): string {
  if (site.icon) return site.icon;
  if (site.id < 0) return "";
  try {
    const origin = new URL(site.url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return "";
  }
}

export default function BookmarkPage() {
  const { tx } = useTranslation();
  const [data, setData] = useState<CuratedBookmarkCategory[]>(curatedBookmarkCategories);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBookmarks()
      .then((backendBookmarks) => setData(mergeBookmarkCategories(backendBookmarks)))
      .catch(() => setData(mergeBookmarkCategories([])))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageCover title="收藏夹" description="收集常用的好用站点和工具" eyebrow="灵感 · 工具 · 收藏" />
      <div id="page-content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10">
      {loading && (
        <p className="mb-5 text-center text-xs text-slate-400" role="status">{tx("正在同步你的收藏…")}</p>
      )}
      {data.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          {tx("暂无收藏")}
        </div>
      ) : (
        <div className="space-y-10 md:space-y-14">
          {data.map((category, catIndex) => (
            <motion.section
              key={category.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: catIndex * 0.1 }}
            >
              {/* Category Header */}
              <div className="flex items-center gap-2.5 mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">
                  {tx(category.name)}
                </h2>
                <span className="text-xs text-slate-400 bg-slate-100/50 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                  {category.sites.length}
                </span>
              </div>
              {category.description && (
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-4 -mt-2">
                  {tx(category.description)}
                </p>
              )}

              {/* Site Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                {category.sites.map((site, siteIndex) => (
                  <div key={site.id} className="min-w-0">
                  <motion.a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: catIndex * 0.1 + siteIndex * 0.03
                    }}
                    className="group relative flex items-center gap-2.5 p-2.5 rounded-xl bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm border border-transparent hover:border-sky-200 dark:hover:border-sky-800 transition-all duration-300 cursor-pointer"
                  >
                    {/* Icon */}
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-slate-100/60 dark:bg-slate-700/40 flex items-center justify-center group-hover:animate-[icon-jelly_2s_ease-in-out]">
                      {getIcon(site) ? (
                        <img
                          src={getIcon(site)}
                          alt={site.name}
                          className="h-7 w-7 object-contain"
                          onError={e => {
                            const t = e.target as HTMLImageElement;
                            t.style.display = "none";
                            const span = t.nextElementSibling as HTMLElement;
                            if (span) span.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className="items-center justify-center text-slate-500 dark:text-slate-300"
                        style={{ display: getIcon(site) ? "none" : "flex" }}
                      >
                        <Shapes className="h-5 w-5" aria-hidden="true" />
                      </span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {tx(site.name)}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                        {tx(site.description)}
                      </p>
                    </div>
                    {/* Hover: top-right tags + link */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {site.platforms.slice(0, 2).map(p => (
                        <span
                          key={p}
                          className="text-[8px] font-medium tracking-wider uppercase text-sky-500/70"
                        >
                          {p}
                        </span>
                      ))}
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                    </div>
                  </motion.a>
                  {site.sourceUrl && (
                    <a
                      href={site.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${tx(site.name)} ${tx("开源地址")}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
                    >
                      <GitBranch className="h-3 w-3" />
                      {tx("开源地址")}
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </a>
                  )}
                  </div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
