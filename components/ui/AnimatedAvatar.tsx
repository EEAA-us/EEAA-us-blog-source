"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { siteConfig } from "@/siteConfig";
import { useDeferredMedia } from "./useDeferredMedia";

export default function AnimatedAvatar({ sizes }: { sizes: string }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { reducedMotion } = useAppearance();
  const sourceReady = useDeferredMedia(visible && !reducedMotion);
  const shouldPlay = visible && ready && !failed && !reducedMotion;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver((entries) => { const entry = entries.at(-1); if (entry) { intersecting = entry.isIntersecting; update(); } });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;

    // Read media state as well as listening for canplay so readiness is not
    // dependent on receiving only one event.
    if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setReady(true);

    if (!shouldPlay || document.hidden) {
      element.pause();
      return;
    }

    let active = true;
    let playAttempt = 0;
    const tryPlay = () => {
      if (!active || !shouldPlay || document.hidden || !element.paused
        || element.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;

      const attempt = ++playAttempt;
      void element.play().catch((error: unknown) => {
        if (!active || attempt !== playAttempt) return;
        const errorName = error instanceof DOMException ? error.name : "";
        // pause() can interrupt an in-flight play(). That expected race should
        // not mark the avatar as failed; later media/visibility/input events retry.
        if (errorName === "AbortError") return;
        if (element.error) setFailed(true);
      });
    };
    const handleCanPlay = () => {
      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setReady(true);
      tryPlay();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        playAttempt++;
        element.pause();
      } else {
        tryPlay();
      }
    };

    element.addEventListener("canplay", handleCanPlay);
    element.addEventListener("pointerdown", tryPlay);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    tryPlay();

    return () => {
      active = false;
      playAttempt++;
      element.removeEventListener("canplay", handleCanPlay);
      element.removeEventListener("pointerdown", tryPlay);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [shouldPlay]);

  useEffect(() => {
    const element = video.current;
    return () => { element?.pause(); };
  }, []);
  return <div ref={root} className="relative h-full w-full" data-animated-avatar>
    <Image src={siteConfig.avatarUrl} alt="小站作者头像" fill sizes={sizes} className="object-cover" />
    {siteConfig.avatarVideo && !failed && <video ref={video} src={sourceReady ? siteConfig.avatarVideo : undefined} poster={siteConfig.avatarUrl} muted loop playsInline preload={sourceReady && visible && !reducedMotion ? "auto" : "none"} aria-hidden="true" onCanPlay={() => setReady(true)} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: ready && !reducedMotion ? 1 : 0 }} />}
  </div>;
}
