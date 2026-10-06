"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import CoverTypewriter from "./CoverTypewriter";
import { siteConfig } from "@/siteConfig";
import { CoverMediaSlot } from "@/components/providers/CoverMediaProvider";
import CoverContours from "./CoverContours";
import { useTranslation } from "@/lib/i18n";

interface PageCoverProps {
  title: string;
  description?: string;
  eyebrow?: string;
  home?: boolean;
  image?: string;
}

export function CoverTransition() {
  const { preferences } = useAppearance();
  return <CoverContours effect={preferences.coverEffect} layers={preferences.waveLayers} />;
}

export default function PageCover({ title, description, eyebrow, home = false, image }: PageCoverProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<number | null>(null);
  const initializedPathRef = useRef<string | null>(null);
  const pathname = usePathname();
  const { preferences, reducedMotion, mediaCatalog } = useAppearance();
  const { tx } = useTranslation();
  const mediaPreset = preferences.heroMode === "animated"
    ? mediaCatalog.items.find((item) => item.kind === preferences.heroMediaKind && (preferences.heroMediaUrl ? item.url === preferences.heroMediaUrl : true)) : undefined;

  useLayoutEffect(() => {
    if (home) return;
    const stage = stageRef.current;
    const cover = stage?.querySelector<HTMLElement>(".page-cover");
    const copy = stage?.querySelector<HTMLElement>(".page-cover-copy");
    if (!stage || !cover || !copy) return;
    if (initializedPathRef.current !== pathname) {
      initializedPathRef.current = pathname;
      revealRef.current = null;
    }
    let frame = 0;
    let pinDistance = 0;
    let distance = Math.max(1, cover.clientHeight * 0.5);
    let previousScroll = 0;
    const measure = () => {
      const height = cover.clientHeight;
      const copyBottom = copy.getBoundingClientRect().bottom - cover.getBoundingClientRect().top;
      const waveHeight = Math.max(0, Math.min(Math.min(112, Math.max(64, window.innerWidth * 0.08)) * preferences.waveAmplitude / 100, height - copyBottom - 24));
      pinDistance = Math.max(0, Math.min(120, height * 0.15, height - copyBottom - waveHeight - 24));
      stage.style.setProperty("--cover-pin-distance", `${pinDistance}px`);
      stage.style.setProperty("--cover-wave-height", `${waveHeight}px`);
      distance = Math.max(1, height * 0.5);
      previousScroll = Math.max(0, window.scrollY - pinDistance);
    };
    measure();
    if (revealRef.current === null) {
      revealRef.current = reducedMotion ? 1 : 0;
      stage.style.setProperty("--cover-reveal", String(revealRef.current));
    }
    const update = () => {
      frame = 0;
      if (reducedMotion) return;
      const scroll = Math.max(0, window.scrollY - pinDistance);
      revealRef.current = Math.min(1, Math.max(0, (revealRef.current ?? 1) + (scroll - previousScroll) / distance));
      previousScroll = scroll;
      stage.style.setProperty("--cover-reveal", String(revealRef.current));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(measure);
    observer.observe(cover);
    observer.observe(copy);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
    };
  }, [home, pathname, reducedMotion, preferences.waveAmplitude]);

  const cover = (
    <header className={`page-cover ${home ? "page-cover-home" : ""}`}>
      <div className="page-cover-scene" aria-hidden="true">
        <CoverMediaSlot />
        {image && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${image.replaceAll('"', '')}")` }} />}
        <div className="page-cover-shade" />
        <div className="page-cover-mist" />
      </div>
      <div className="page-cover-copy relative z-10 mx-auto max-w-4xl px-6 text-center text-white">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[.32em] text-white/80">{tx(eyebrow ?? "学习 · 生活 · 灵感")}</p>
        <h1 className={home ? "text-5xl font-bold tracking-[.1em] sm:text-7xl" : "text-3xl font-bold leading-tight sm:text-5xl"}>{home ? title : tx(title)}</h1>
        {home ? <CoverTypewriter phrases={siteConfig.heroSubtitles} /> : description && <p className="cover-subtitle mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{tx(description)}</p>}
        <a href="#page-content" className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-xs text-white backdrop-blur-sm transition-colors hover:bg-white/25">
          {tx(home ? "向下，发现新的记录" : "开始阅读")}<ArrowDown className="h-3.5 w-3.5" />
        </a>
        {mediaPreset && <p className="mt-3 text-[10px] text-white/65"><a href={mediaPreset.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{mediaPreset.name}</a>{mediaPreset.author && mediaPreset.author !== "原作者未注明" && <> · {mediaPreset.author}</>}{mediaPreset.licenseUrl && <> · <a href={mediaPreset.licenseUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">CC BY 3.0</a></>}</p>}
      </div>
    </header>
  );

  if (home) return cover;
  return (
    <div ref={stageRef} className="page-cover-stage">
      {cover}
      <CoverTransition />
    </div>
  );
}
