"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Photo } from "@/data/photos";
import { photoThumbnail } from "@/lib/photo-thumbnail";

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

function PhotoImage({ photo, ratio, attempt, onRetry }: { photo: Photo; ratio: string; attempt: number; onRetry: () => void }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useOriginal, setUseOriginal] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const source = useOriginal ? photo.url : photoThumbnail(photo.url);
  const retrySource = attempt > 0 && source.startsWith("/") && !source.startsWith("//")
    ? `${source}${source.includes("?") ? "&" : "?"}photo_retry=${attempt}` : source;
  useEffect(() => {
    if (status !== "loading") return;
    // Cached images may already have completed before the component subscribed.
    if (image.current?.complete && image.current.naturalWidth > 0) {
      const frame = requestAnimationFrame(() => setStatus("loaded"));
      return () => cancelAnimationFrame(frame);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => { timer ??= setTimeout(() => setStatus("error"), 20_000); };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { start(); observer?.disconnect(); }
    }, { rootMargin: "150px" });
    if (observer && container.current) observer.observe(container.current);
    else start();
    return () => { observer?.disconnect(); clearTimeout(timer); };
  }, [status, source]);

  return <div ref={container} className={`relative overflow-hidden rounded-[1px] ${ratio}`}>
    <Image ref={image} src={retrySource}
      unoptimized={photo.url.startsWith("/images/games/") || photo.url.startsWith("/images/anime-stills/") || photo.url.startsWith("/images/article-covers/")}
      alt={photo.caption || "照片"} fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
      className={`object-cover transition-transform duration-500 group-hover:scale-105 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setStatus("loaded")} onError={() => {
        if (source !== photo.url) setUseOriginal(true);
        else setStatus("error");
      }} />
    {status === "loading" && <div className={`w-full bg-slate-200 dark:bg-slate-700 animate-pulse ${ratio}`} />}
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
    {status === "error" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500" role="status">
      <span>图片暂未加载</span>
      <button type="button" className="relative z-10 rounded-md px-3 py-1 text-sky-500 hover:bg-sky-500/10" onClick={event => { event.stopPropagation(); onRetry(); }}>重试</button>
    </div>}
  </div>;
}

export default function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const [attempt, setAttempt] = useState(0);

  const isLandscape = photo.orientation === "landscape";
  const imageRatio = isLandscape ? "aspect-[4/3]"
    : photo.orientation === "square" ? "aspect-square" : "aspect-[4/5]";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="relative cursor-pointer group break-inside-avoid mb-3 md:mb-5"
      style={{ transformOrigin: "center center" }}
    >
      {/* 照片外框 */}
      <div className="relative bg-white dark:bg-slate-800 p-2 pb-6 md:p-2.5 md:pb-8 rounded-sm shadow-lg dark:shadow-black/30 group-hover:shadow-2xl transition-shadow duration-300">
        {/* 照片 */}
        <PhotoImage key={`${photo.url}\0${attempt}`} photo={photo} ratio={imageRatio} attempt={attempt} onRetry={() => setAttempt(value => value + 1)} />

        {/* caption */}
        {photo.caption && (
          <div className="absolute bottom-1.5 left-0 right-0 text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-serif italic tracking-wide">
              {photo.caption}
            </span>
          </div>
        )}
      </div>

      {/* 胶带装饰 */}
      <div
        className="absolute -top-2 left-2 md:left-3 w-8 h-3 md:w-10 md:h-4 bg-amber-200/60 dark:bg-amber-300/30 rounded-sm rotate-[-6deg] pointer-events-none"
        style={{ backdropFilter: "blur(2px)" }}
      />
    </motion.div>
  );
}
