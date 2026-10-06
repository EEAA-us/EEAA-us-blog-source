"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useDeferredMedia } from "./useDeferredMedia";

function AnimatedVideo({ src, poster, playing }: { src: string; poster: string; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sourceReady = useDeferredMedia(playing);
  useEffect(() => {
    const video = ref.current;
    if (!video || !ready || failed) return;
    const sync = () => {
      if (playing) void video.play().catch(() => {});
      else video.pause();
    };
    sync();
    document.addEventListener("cover-media-attached", sync);
    return () => document.removeEventListener("cover-media-attached", sync);
  }, [playing, ready, failed]);
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {!failed && <img src={poster} alt="" className="home-cover-image" />}
    <video ref={ref} src={sourceReady ? src : undefined} muted loop playsInline preload={playing && sourceReady ? "auto" : "none"} poster={poster}
    onCanPlay={() => setReady(true)} onError={() => setFailed(true)}
    className="home-cover-video" style={{ opacity: ready && !failed ? 1 : 0 }} />
  </>;
}

function AnimatedImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="home-cover-image" onError={() => setFailed(true)} />;
}

export default function CoverMedia({ image }: { image: string }) {
  const { preferences, reducedMotion, welcomeActive, mediaCatalog } = useAppearance();
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(0);
  const transitioningRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [welcomeFinished, setWelcomeFinished] = useState(!welcomeActive);
  const [frame, setFrame] = useState({ source: preferences.heroSlides[0] || image, previous: "" });
  const slidesKey = JSON.stringify(preferences.heroSlides);
  const slides = useMemo<string[]>(() => {
    const selected = JSON.parse(slidesKey) as string[];
    return selected.length ? selected : [image];
  }, [slidesKey, image]);
  const compatiblePreset = mediaCatalog.items.find((item) => item.kind === preferences.heroMediaKind);
  const mediaUrl = preferences.heroMediaUrl || compatiblePreset?.url || "";
  const preset = mediaCatalog.items.find((item) => item.url === mediaUrl);
  const customMedia = preferences.heroCustomMedia.find((item) => item.url === mediaUrl);
  const mediaExtension = (() => {
    try { return new URL(mediaUrl, "https://local.invalid").pathname.split(".").pop()?.toLowerCase(); }
    catch { return ""; }
  })();
  const detectedKind = customMedia?.kind ?? preset?.kind ??
    (mediaExtension === "gif" || mediaExtension === "webp" ? "gif" : ["mp4", "webm", "ogg", "mov"].includes(mediaExtension ?? "") ? "video" : undefined);
  const validAnimatedMedia = detectedKind === preferences.heroMediaKind;
  const playing = visible && !reducedMotion && !welcomeActive && welcomeFinished;

  useEffect(() => {
    if (welcomeActive || welcomeFinished) return;
    const timer = window.setTimeout(() => setWelcomeFinished(true), 800);
    return () => window.clearTimeout(timer);
  }, [welcomeActive, welcomeFinished]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver((entries) => { const entry = entries.at(-1); if (entry) { intersecting = entry.isIntersecting; update(); } });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    if (preferences.heroMode !== "slideshow" || !playing || slides.length < 2) return;
    let cancelled = false;
    let pending: HTMLImageElement | null = null;
    const timer = window.setInterval(() => {
      if (pending || transitioningRef.current) return;
      cursorRef.current = (cursorRef.current + 1) % slides.length;
      const source = slides[cursorRef.current];
      const next = new window.Image();
      pending = next;
      next.onload = async () => {
        try { await next.decode(); } catch { /* onload already confirms a displayable image */ }
        if (!cancelled) {
          transitioningRef.current = true;
          setFrame((previous) => previous.source === source ? previous : { source, previous: previous.source });
        }
        pending = null;
      };
      next.onerror = () => { pending = null; };
      next.src = source;
    }, preferences.heroInterval * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (pending) { pending.onload = null; pending.onerror = null; }
    };
  }, [preferences.heroMode, preferences.heroInterval, playing, slides]);

  useEffect(() => {
    cursorRef.current = 0;
    transitioningRef.current = false;
    let cancelled = false;
    const first = new window.Image();
    first.onload = async () => {
      try { await first.decode(); } catch { /* The loaded image remains usable. */ }
      if (!cancelled) setFrame({ source: slides[0], previous: "" });
    };
    first.src = slides[0];
    return () => { cancelled = true; first.onload = null; };
  }, [slides]);

  const fadeDuration = Math.min(1200, preferences.heroInterval * 600);
  useEffect(() => {
    if (!frame.previous) return;
    const timer = window.setTimeout(() => {
      transitioningRef.current = false;
      setFrame((current) => ({ ...current, previous: "" }));
    }, fadeDuration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [frame.previous, frame.source, fadeDuration]);

  const current = preferences.heroMode === "slideshow" ? frame.source : preferences.heroMode === "fixed" ? (preferences.heroSlides[0] || image) : image;
  const animated = preferences.heroMode === "animated";
  return <div ref={rootRef} className="home-cover-media" data-mode={preferences.heroMode}>
    {/* Local WebP assets are already compressed and preloaded before each transition. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preferences.heroMode === "slideshow" && frame.previous && <img src={frame.previous} alt="" className="home-cover-image" />}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={current} src={current} alt="" fetchPriority="high" className={`home-cover-image ${preferences.heroMode === "slideshow" && frame.previous ? "home-cover-fade" : ""}`} style={{ animationDuration: `${fadeDuration}ms` }} />
    {animated && validAnimatedMedia && preferences.heroMediaKind === "video" && <AnimatedVideo key={mediaUrl} src={mediaUrl} poster={preset?.poster ?? image} playing={playing} />}
    {animated && validAnimatedMedia && preferences.heroMediaKind === "gif" && mediaUrl && playing && <AnimatedImage key={mediaUrl} src={mediaUrl} />}
  </div>;
}
