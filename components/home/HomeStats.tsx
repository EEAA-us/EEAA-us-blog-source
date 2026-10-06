"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { projects } from "@/app/projects/projectsData";
import { siteConfig } from "@/siteConfig";
import { useTranslation } from "@/lib/i18n";

export default function HomeStats({ postCount, photoCount }: { postCount: number | null; photoCount: number | null }) {
  const [siteDays, setSiteDays] = useState<number | null>(null);
  const { tx, language } = useTranslation();
  useEffect(() => {
    const refresh = () => setSiteDays(Math.max(0, Math.floor((Date.now() - new Date(siteConfig.buildDate).getTime()) / 86_400_000)));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="editorial-panel p-5" aria-label={tx("小站统计")}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><ChartNoAxesCombined className="h-4 w-4 text-sky-500" />{tx("小站统计")}</h2>
      <div className="grid grid-cols-2 gap-3">
        {[{ label: "已发布文章", value: postCount, href: "/posts" }, { label: "照片收藏", value: photoCount, href: "/photowall" }, { label: "项目记录", value: projects.length, href: "/projects" }].map(({ label, value, href }) => (
          <Link key={href} href={`${href}#page-content`} scroll={false} className="theme-soft-button rounded-xl p-3 transition-colors"><strong className="block text-xl tabular-nums">{value ?? "—"}</strong><span className="text-xs text-slate-500 dark:text-slate-400">{tx(label)}</span></Link>
        ))}
        <div className="theme-soft-button rounded-xl p-3"><strong className="block text-xl tabular-nums">{siteDays ?? "—"}</strong><span className="text-xs text-slate-500 dark:text-slate-400">{tx("建站天数")}</span></div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{language === "en" ? `${tx("开始积累")} ${siteConfig.buildDate.slice(0, 10)}` : language === "ja" ? `${tx("开始积累")} ${siteConfig.buildDate.slice(0, 10)}` : `从 ${siteConfig.buildDate.slice(0, 10)} 开始积累`}{postCount === null || photoCount === null ? ` · ${tx("部分统计暂不可用")}` : ""}</p>
    </section>
  );
}
