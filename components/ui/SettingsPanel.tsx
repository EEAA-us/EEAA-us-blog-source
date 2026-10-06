"use client";

import { useEffect, useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useBackground } from "@/components/providers/BackgroundProvider";
import { fallbackPhotoWallAlbums, loadPhotoWallAlbums } from "@/lib/photo-wall-gallery";
import { useTranslation } from "@/lib/i18n";
import { validHeroMediaUrl } from "@/lib/appearance";

type WallStatus = "idle" | "loading" | "ready" | "error";

function isBackgroundAddress(value: string) {
  return !!value && value.length <= 1500 && !/[\s\u0000-\u001f]/.test(value) && validHeroMediaUrl(value);
}

export default function SettingsPanel() {
  const { tx } = useTranslation();
  const { bgImage, bgBlur, setBgImage, setBgBlur } = useBackground();
  const { change } = useAppearance();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [albums, setAlbums] = useState(fallbackPhotoWallAlbums);
  const [category, setCategory] = useState("all");
  const [wallStatus, setWallStatus] = useState<WallStatus>("idle");
  const [wallRetry, setWallRetry] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    loadPhotoWallAlbums().then((result) => {
      if (active) {
        setAlbums(result);
        setWallStatus("ready");
      }
    }, () => {
      if (active) setWallStatus("error");
    });
    return () => { active = false; };
  }, [pickerOpen, wallRetry]);

  const photos = albums.flatMap((album) => album.photos.map((photo, index) => ({
    url: photo.url,
    name: photo.caption.trim() || `${album.title} · ${tx("图片 {n}", { n: index + 1 })}`,
    category: String(album.id),
  })));
  const uniquePhotos = photos.filter((photo, index) =>
    photos.findIndex((candidate) => candidate.url === photo.url) === index);
  const visiblePhotos = uniquePhotos.filter((photo) => category === "all" || photo.category === category);

  function applyBackground(url: string) {
    setBgImage(url);
    change({ background: "image" });
    setPickerOpen(false);
    setError("");
  }

  function addAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = draft.trim();
    if (!isBackgroundAddress(url)) {
      setError(tx("请输入 HTTPS 图片直链或本站图片路径。"));
      return;
    }
    applyBackground(url);
    setDraft("");
  }

  return (
    <section className="mt-3 min-w-0" aria-label={tx("背景设置")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tx("背景图片")}</h3>
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => { if (!pickerOpen) setWallStatus("loading"); setPickerOpen(!pickerOpen); setCategory("all"); setError(""); }}
          className="rounded-lg border border-slate-300/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:text-slate-200 dark:hover:text-sky-300"
        >
          {tx(pickerOpen ? "关闭照片墙" : "从照片墙选择背景")}
        </button>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-white/40 bg-white/30 dark:border-white/10 dark:bg-slate-900/30">
        <div className="relative h-32 overflow-hidden bg-slate-200/60 dark:bg-slate-800/60 sm:h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bgImage} alt={tx("当前背景图片预览")} className="h-full w-full object-cover" />
        </div>
        <p className="truncate px-3 py-2 text-xs text-slate-600 dark:text-slate-300" title={bgImage}>{tx("当前背景")}: {bgImage}</p>
      </div>

      {pickerOpen && <section className="mb-4 rounded-xl border border-slate-200/80 bg-white/35 p-3 dark:border-slate-700/80 dark:bg-slate-900/30" aria-label={tx("照片墙图库")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{tx("选择一张背景图片")}</h4>
          <span className="text-[11px] text-slate-500 dark:text-slate-400" role="status">
            {wallStatus === "loading" ? tx("正在加载照片墙相册…") : tx("{n} 张图片", { n: visiblePhotos.length })}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={tx("相册分类")}>
          {[["all", "全部相册"], ...albums.map((album) => [String(album.id), album.title])].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${category === value ? "bg-sky-500 text-white" : "bg-white/60 text-slate-600 hover:bg-sky-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}>
              {tx(label)}
            </button>
          ))}
        </div>
        {wallStatus === "error" && <p className="mb-2 text-xs text-amber-700 dark:text-amber-300" role="alert">
          {tx("照片墙相册加载失败，仍可选择已加载的图片。")}{" "}
          <button type="button" onClick={() => { setWallStatus("loading"); setWallRetry((value) => value + 1); }} className="font-semibold underline underline-offset-2">{tx("重试")}</button>
        </p>}
        {wallStatus === "loading" && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{tx("正在加载照片墙相册…")}</p>}
        {visiblePhotos.length > 0 ? <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {visiblePhotos.map((photo) => <button key={photo.url} type="button" aria-label={tx("使用图片：{name}", { name: photo.name })} aria-pressed={photo.url === bgImage} onClick={() => applyBackground(photo.url)} className={`group overflow-hidden rounded-lg border text-left transition-colors ${photo.url === bgImage ? "border-sky-500 ring-2 ring-sky-500/30" : "border-transparent hover:border-sky-400"}`}>
            <div className="aspect-video overflow-hidden bg-slate-200/60 dark:bg-slate-800/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
            </div>
            <span className="block truncate px-1.5 py-1 text-[10px] text-slate-600 dark:text-slate-300">{photo.name}</span>
          </button>)}
        </div> : <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">{tx("这个相册还没有可选图片。")}</p>}
      </section>}

      <form onSubmit={addAddress} className="mb-4 space-y-2">
        <label htmlFor="background-image-address" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{tx("图片直链或本站路径")}</label>
        <div className="flex min-w-0 gap-2">
          <input id="background-image-address" type="text" inputMode="url" autoComplete="url" value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} placeholder={tx("https://… 或 /images/…")} className="min-w-0 flex-1 rounded-lg border border-slate-300/70 bg-white/60 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100" />
          <button type="submit" className="shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-600">{tx("添加并使用背景")}</button>
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-300" role="alert">{error}</p>}
      </form>

      <div>
        <label htmlFor="background-blur" className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">{tx("背景模糊度")}</label>
        <div className="flex items-center gap-3">
          <input id="background-blur" type="range" min="0" max="20" step="1" aria-label={tx("背景模糊度")} value={bgBlur} onChange={(event) => setBgBlur(Number(event.target.value))} className="min-w-0 flex-1 cursor-pointer" style={{ background: `linear-gradient(to right, #818cf8 ${(bgBlur / 20) * 100}%, rgba(148,163,184,0.4) ${(bgBlur / 20) * 100}%)` }} />
          <span className="w-10 text-right text-xs font-bold text-slate-600 dark:text-slate-400">{bgBlur}px</span>
        </div>
      </div>
    </section>
  );
}
