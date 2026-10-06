"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import PortalOverlay from "./PortalOverlay";
import { getWallpaperHistory, rememberWallpaper } from "@/lib/wallpaper-history";

const games = [
  { id: "genshin", label: "原神" },
  { id: "starrail", label: "星穹铁道" },
  { id: "zzz", label: "绝区零" },
  { id: "wuthering", label: "鸣潮" },
] as const;

type GameId = (typeof games)[number]["id"];
type ImageResult = { id: string; imageUrl: string; previewUrl: string; sourceUrl: string };

export default function GameImagesApp() {
  const { language, tx } = useTranslation();
  const [game, setGame] = useState<GameId>("genshin");
  const [image, setImage] = useState<ImageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fullResolutionReady, setFullResolutionReady] = useState(false);
  const [fullResolutionFailed, setFullResolutionFailed] = useState(false);
  const requestId = useRef(0);
  const initialLoadStarted = useRef(false);

  const fetchImage = useCallback(async (selectedGame: GameId) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ game: selectedGame });
      params.set("seen", getWallpaperHistory().slice(0, 600).join(","));
      const response = await fetch(`/api/game-image?${params}`, { cache: "no-store" });
      const result: ImageResult & { message?: string } = await response.json();
      if (!response.ok) throw new Error(result.message || "图片加载失败");

      if (currentRequest === requestId.current) {
        rememberWallpaper(result.id);
        setPreviewLoading(true);
        setImage(result);
      }
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : "图片加载失败，请重试");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void fetchImage("genshin");
  }, [fetchImage]);

  const selectGame = (nextGame: GameId) => {
    requestId.current += 1;
    setGame(nextGame);
    setImage(null);
    setError("");
    setLoading(false);
    setPreviewLoading(false);
    setFullscreen(false);
    void fetchImage(nextGame);
  };

  const sourceGameName = games.find((item) => item.id === game)?.label ?? "原神";
  const gameName = language === "en"
    ? ({ genshin: "Genshin Impact", starrail: "Honkai: Star Rail", zzz: "Zenless Zone Zero", wuthering: "Wuthering Waves" } as const)[game]
    : language === "ja"
      ? ({ genshin: "原神", starrail: "崩壊：スターレイル", zzz: "ゼンレスゾーンゼロ", wuthering: "鳴潮" } as const)[game]
      : sourceGameName;

  useEffect(() => {
    if (!fullscreen || !image || image.imageUrl === image.previewUrl) return;
    let active = true;
    const fullImage = new Image();
    fullImage.onload = () => { if (active) setFullResolutionReady(true); };
    fullImage.onerror = () => { if (active) setFullResolutionFailed(true); };
    fullImage.src = image.imageUrl;
    return () => { active = false; };
  }, [fullscreen, image]);

  const openFullscreen = () => {
    setFullResolutionReady(false);
    setFullResolutionFailed(false);
    setFullscreen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {games.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectGame(item.id)}
            aria-pressed={game === item.id}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
              game === item.id
                ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
          {language === "en" ? ({ genshin: "Genshin Impact", starrail: "Honkai: Star Rail", zzz: "Zenless Zone Zero", wuthering: "Wuthering Waves" } as const)[item.id] : language === "ja" ? ({ genshin: "原神", starrail: "崩壊：スターレイル", zzz: "ゼンレスゾーンゼロ", wuthering: "鳴潮" } as const)[item.id] : item.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void fetchImage(game)}
        disabled={loading}
        className="w-full rounded-xl bg-indigo-500 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-600 disabled:opacity-60"
      >
        {loading ? tx("加载中...") : language === "en" ? `Random ${gameName} image` : language === "ja" ? `${gameName}の画像をランダム表示` : `随机一张${gameName}图片`}
      </button>

      {error && <p role="alert" className="text-center text-xs text-rose-500">{error}</p>}

      {image ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={openFullscreen}
            disabled={previewLoading}
            className="block w-full overflow-hidden rounded-xl bg-slate-100 disabled:cursor-wait dark:bg-slate-800"
            title={tx("查看大图")}
          >
            {previewLoading && <span className="block py-12 text-center text-xs text-slate-400">{tx("图片加载中...")}</span>}
            {/* External providers return image URLs at runtime. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt={language === "en" ? `Random ${gameName} image` : language === "ja" ? `${gameName}のランダム画像` : `${gameName}随机图片`}
              className={`h-auto w-full ${previewLoading ? "hidden" : ""}`}
              onLoad={() => setPreviewLoading(false)}
              onError={() => { setPreviewLoading(false); setImage(null); setError(tx("图片无法显示，请换一张")); }}
            />
          </button>
          <a
            href={image.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-right text-xs text-indigo-500 hover:underline"
          >
            {tx("查看图片来源")} ↗
          </a>
        </div>
      ) : !loading && !error ? (
        <p className="py-10 text-center text-xs text-slate-400">{tx("选择游戏，看看随机图片")}</p>
      ) : null}

      {fullscreen && image && (
        <PortalOverlay>
          <div
            className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
            onClick={() => setFullscreen(false)}
            role="presentation"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullResolutionReady ? image.imageUrl : image.previewUrl}
              alt={language === "en" ? `Random ${gameName} image, full size` : language === "ja" ? `${gameName}のランダム画像（拡大）` : `${gameName}随机图片大图`}
              className="h-[90vh] w-[95vw] object-contain"
            />
            {!fullResolutionReady && image.imageUrl !== image.previewUrl && (
              <span className="absolute bottom-5 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                {fullResolutionFailed ? tx("原图暂时无法加载，正在显示预览图") : tx("正在加载清晰原图...")}
              </span>
            )}
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              title={tx("关闭大图")}
              className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-lg text-white hover:bg-white/30"
            >
              ×
            </button>
          </div>
        </PortalOverlay>
      )}
    </div>
  );
}
