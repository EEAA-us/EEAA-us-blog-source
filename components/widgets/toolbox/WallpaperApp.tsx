"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ImageIcon, RefreshCw, X } from "lucide-react";
import PortalOverlay from "./PortalOverlay";
import { getWallpaperHistory, rememberWallpaper } from "@/lib/wallpaper-history";

const categories = [
  { id: "featured", name: "热门精选" },
  { id: "anime", name: "二次元" },
  { id: "landscape", name: "风景" },
  { id: "desktop", name: "横屏壁纸" },
  { id: "portrait", name: "竖屏壁纸" },
];

interface Wallpaper { id: string; imageUrl: string; sourceUrl: string; width: number; height: number; }

export default function WallpaperApp({ kind = "random" }: { kind?: "random" | "4k" }) {
  const { tx } = useTranslation();
  const [category, setCategory] = useState(kind === "4k" ? "anime" : "featured");
  const [image, setImage] = useState<Wallpaper | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoomed, setZoomed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const busy = loading || imageLoading;
  const tabs = kind === "4k" ? categories.filter((item) => ["anime", "landscape"].includes(item.id)) : categories;

  useEffect(() => () => { requestId.current++; requestRef.current?.abort(); }, []);
  useEffect(() => {
    if (!zoomed) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopImmediatePropagation(); setZoomed(false); }
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [zoomed]);
  useEffect(() => {
    if (!imageLoading) return;
    const timer = window.setTimeout(() => {
      setImageLoading(false); setImage(null); setError(tx("图片加载较慢，请换一张或稍后重试"));
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [imageLoading, image?.id, tx]);

  const selectCategory = (next: string) => {
    if (next === category) return;
    requestId.current++; requestRef.current?.abort();
    setCategory(next); setImage(null); setLoading(false); setImageLoading(false); setError("");
  };
  const fetchImage = async () => {
    const id = ++requestId.current;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ kind, category });
      params.set("seen", getWallpaperHistory().slice(0, 600).join(","));
      const response = await fetch(`/api/random-image?${params}`, { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || tx("暂时无法获取图片"));
      if (id !== requestId.current) return;
      rememberWallpaper(result.id);
      setImageLoading(true); setImage(result);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : tx("暂时无法获取图片"));
    } finally { if (id === requestId.current) setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => selectCategory(item.id)} aria-pressed={category === item.id} className="toolbox-image-tab">{tx(item.name)}</button>)}
      </div>
      <button type="button" onClick={() => void fetchImage()} disabled={busy} className="toolbox-image-refresh">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? tx("正在加载图片…") : image ? tx("换一张") : kind === "4k" ? tx("随机一张 4K 图片") : tx("随机一张图片")}
      </button>
      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
      <button type="button" onClick={() => setZoomed(true)} disabled={!image || busy || !!error} aria-label={tx("查看完整大图")} className="toolbox-wallpaper-preview">
        {image ? (
          // Reuse the fixed original URL, never a cropped thumbnail or random redirect.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image.id} src={image.imageUrl} alt={tx("随机壁纸")} style={{ opacity: imageLoading ? 0 : 1 }} onLoad={() => setImageLoading(false)} onError={() => { setImageLoading(false); setImage(null); setError(tx("图片无法显示，请换一张")); }} />
        ) : <span className="flex flex-col items-center gap-3 text-xs text-[var(--ui-muted)]"><ImageIcon className="h-7 w-7 opacity-50" />{tx("选一个分类，看看今天的图片")}</span>}
        {busy && <span className="toolbox-image-loading">{tx("正在加载…")}</span>}
      </button>
      {image && !busy && !error && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--ui-muted)]">
          <span>{image.width} × {image.height} · {tx("点击查看完整大图")}</span>
          <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:underline">{tx("来源")} ↗</a>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-[var(--ui-muted)]">{tx("Wallhaven 人气壁纸")} · {kind === "4k" ? "3840 × 2160" : tx("全高清及以上")}</p>
      {zoomed && image && (
        <PortalOverlay>
          <div className="toolbox-wallpaper-lightbox" role="dialog" aria-modal="true" aria-label={tx("完整图片")} onClick={() => setZoomed(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.imageUrl} alt={tx("完整随机壁纸")} />
            <button type="button" aria-label={tx("关闭大图")} onClick={() => setZoomed(false)} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
          </div>
        </PortalOverlay>
      )}
    </div>
  );
}
