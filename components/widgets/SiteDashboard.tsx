"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/siteConfig";
import { useTranslation } from "@/lib/i18n";

export default function SiteDashboard() {
  const [timeStr, setTimeStr] = useState("");
  const [uptimeStr, setUptimeStr] = useState("");
  const { tx, language } = useTranslation();

  const START_DATE = new Date(
    siteConfig.buildDate
  ).getTime();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hourCycle: "h23",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );

      const diff = Math.max(0, now.getTime() - START_DATE);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setUptimeStr(language === "en" ? `${days}d ${hours}h ${minutes}m ${seconds}s` : language === "ja" ? `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒` : `${days}天 ${hours}时 ${minutes}分 ${seconds}秒`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [START_DATE, language]);

  return (
    <div className="md:col-span-12 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden flex flex-col md:flex-row items-stretch transition-colors duration-700 h-auto md:h-20 group">
      <div className="bg-slate-900 dark:bg-black text-white px-8 py-4 md:py-0 flex items-center justify-center font-mono text-2xl md:text-3xl font-black tracking-widest shadow-inner relative overflow-hidden group-hover:text-indigo-400 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        {timeStr || "00:00:00"}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-black/50" />
      </div>

      <div className="flex-1 px-6 py-4 md:py-0 flex flex-wrap items-center justify-between gap-4 text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
          <div className="space-y-1">
            <p className="text-xs font-normal text-slate-500 dark:text-slate-400">{tx("开始积累")} · {siteConfig.buildDate.slice(0, 10)}</p>
            <p>{tx("建站至今")}：<span className="font-black tabular-nums" style={{ color: "var(--ui-primary)" }}>{uptimeStr || "—"}</span></p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center md:justify-end">
          {siteConfig.icpConfig?.name && (
            <a
              href={siteConfig.icpConfig.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-500 transition-colors border-b border-dashed border-slate-400 dark:border-slate-500 pb-0.5"
            >
              {siteConfig.icpConfig.name}
            </a>
          )}
          {siteConfig.moeIcpConfig?.name && (
            <a
              href={siteConfig.moeIcpConfig.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-500 transition-colors border-b border-dashed border-slate-400 dark:border-slate-500 pb-0.5"
            >
              {siteConfig.moeIcpConfig.name}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
