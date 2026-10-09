"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { withRequestDeadline } from "@/lib/bounded-request";

const PLATFORMS = [
  { id: "weibo", name: "微博", color: "#e6162d" },
  { id: "zhihu", name: "知乎", color: "#0066ff" },
  { id: "douyin", name: "抖音", color: "#111" },
  { id: "bilibili", name: "B站", color: "#00a1d6" },
  { id: "baidu", name: "百度", color: "#2932e1" },
  { id: "toutiao", name: "头条", color: "#f85959" },
  { id: "tieba", name: "贴吧", color: "#4e6ef2" },
  { id: "douban-movie", name: "豆瓣电影", color: "#00b51d" },
  { id: "hupu", name: "虎扑", color: "#e74c3c" },
  { id: "v2ex", name: "V2EX", color: "#333" },
  { id: "ithome", name: "IT之家", color: "#d32f2f" },
  { id: "36kr", name: "36氪", color: "#0479ff" },
  { id: "juejin", name: "掘金", color: "#1e80ff" },
  { id: "sspai", name: "少数派", color: "#d7191a" },
  { id: "netease-music", name: "网易云", color: "#c20c0c" },
  { id: "qq-music", name: "QQ音乐", color: "#31c27c" },
  { id: "lol", name: "LOL", color: "#c89b3c" },
  { id: "genshin", name: "原神", color: "#e8a946" },
  { id: "honkai", name: "崩坏3", color: "#6c3fa0" },
  { id: "starrail", name: "星铁", color: "#5b7fab" },
  { id: "overwatch", name: "守望先锋", color: "#ed921b" },
  { id: "wuthering-waves", name: "鸣潮", color: "#427e79" },
];

interface HotItem {
  index?: number;
  title: string;
  hot_value: string;
  url: string;
  extra?: Record<string, string>;
  cover?: string;
  source?: string;
  publish_time?: string;
}

interface HotResult {
  type: string;
  update_time: string;
  list: HotItem[];
  notice?: string;
  more_url?: string;
}

export default function HotBoardApp() {
  const { language, tx } = useTranslation();
  const [platform, setPlatform] = useState("weibo");
  const [result, setResult] = useState<HotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function fetchHot(type: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPlatform(type);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await withRequestDeadline(controller.signal, 12_000, async signal => {
        const isGameTopic = type === "overwatch" || type === "wuthering-waves";
        const res = await fetch(isGameTopic ? `/api/game-hotboard?type=${type}` : `/api/uapis?path=misc/hotboard&type=${type}`, { signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "查询失败");
        if (!Array.isArray(json?.list)) throw new Error("热榜数据暂不可用");
        return json as HotResult;
      });
      if (request.current === controller) setResult(data);
    } catch (e) {
      if (request.current === controller) setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }

  function formatHot(val: string) {
    const n = Number(val);
    if (isNaN(n)) return val;
    return new Intl.NumberFormat(language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }

  function formatPublishTime(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString(language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  }

  const currentPlatform = PLATFORMS.find((p) => p.id === platform);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 平台选择 */}
      <div className="flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => fetchHot(p.id)}
            className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-all ${
              platform === p.id
                ? "text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            style={platform === p.id ? { backgroundColor: p.color } : undefined}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* 加载 */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <svg className="w-6 h-6 text-sky-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* 错误 */}
      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* 热榜列表 */}
      {result && !loading && (
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {result.notice && <p className="text-[10px] text-slate-500 mb-2">{result.notice}</p>}
          {result.update_time && (
            <p className="text-[10px] text-slate-400 mb-2">
              {tx("更新于")} {result.update_time}
            </p>
          )}
          {result.list.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
            >
              <span
                className={`w-5 text-center text-[10px] font-bold shrink-0 ${
                  item.index != null && item.index <= 3 ? "text-white rounded-sm" : "text-slate-400"
                }`}
                style={item.index != null && item.index <= 3 ? { backgroundColor: currentPlatform?.color || "#e6162d" } : undefined}
              >
                {item.index ?? "•"}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 group-hover:text-sky-500 transition-colors">
                {item.title}
              </span>
              {item.hot_value && (
                <span className="text-[9px] text-slate-400 shrink-0 tabular-nums">
                  {formatHot(item.hot_value)}
                </span>
              )}
              {item.publish_time && <span className="text-[9px] text-slate-400 shrink-0">{formatPublishTime(item.publish_time)}</span>}
              {item.source && <span className="text-[9px] text-slate-400 shrink-0">{item.source}</span>}
            </a>
          ))}
          {result.list.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">{tx("暂无数据")}</p>
          )}
          {result.more_url && <a href={result.more_url} target="_blank" rel="noopener noreferrer" className="block py-3 text-center text-xs text-sky-500 hover:underline">查看相关视频</a>}
        </div>
      )}

      {/* 初始提示 */}
      {!result && !loading && !error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-400">{tx("选择平台查看实时热榜")}</p>
        </div>
      )}
    </div>
  );
}
