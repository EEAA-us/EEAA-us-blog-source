"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { withRequestDeadline } from "@/lib/bounded-request";

const API = "https://v2.xxapi.cn/api/bilibilihot";

export default function BilibiliHotApp() {
  const { tx } = useTranslation();
  const [list, setList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    withRequestDeadline(controller.signal, 10_000, async signal => {
      const response = await fetch(API, { signal });
      if (!response.ok) throw new Error("Hot list unavailable");
      return response.json();
    })
      .then((json) => {
        if (!active) return;
        if (json.code === 200 && Array.isArray(json.data)) {
          setList(json.data);
        } else {
          setError(json.msg || tx("获取失败"));
        }
      })
      .catch(() => { if (active) setError(tx("网络请求失败")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [tx, attempt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-slate-400 animate-pulse">{tx("加载中...")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div role="alert" className="text-sm text-red-500">{error}<button type="button" className="ml-2 underline" onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }}>{tx("重试")}</button></div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {list.map((item, i) => (
        <a
          key={i}
          href={`https://search.bilibili.com/all?keyword=${encodeURIComponent(item)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
        >
          <span
            className={`shrink-0 w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${
              i < 3
                ? "bg-red-500 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}
          >
            {i + 1}
          </span>
          <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-sky-500 transition-colors truncate">
            {item}
          </span>
        </a>
      ))}
    </div>
  );
}
