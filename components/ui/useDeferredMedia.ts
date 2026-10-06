"use client";

import { useEffect, useState } from "react";

// Keep source attachment separate from playback: a paused video with a src can
// still compete with fonts and the poster for the first network requests.
export function useDeferredMedia(active: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || ready) return;
    let cancelled = false;
    let queued = false;
    let frame = 0;
    let idle = 0;
    let fallback = 0;
    const finish = () => { if (!cancelled) setReady(true); };
    const queue = () => {
      if (cancelled || queued) return;
      queued = true;
      window.clearTimeout(fallback);
      window.removeEventListener("load", queue);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(finish, { timeout: 1200 });
          else fallback = window.setTimeout(finish, 0);
        });
      });
    };
    if (document.readyState === "complete") queue();
    else {
      window.addEventListener("load", queue, { once: true });
      // A stalled unrelated image must not prevent the selected animation forever.
      fallback = window.setTimeout(queue, 8000);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("load", queue);
      window.clearTimeout(fallback);
      window.cancelAnimationFrame(frame);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [active, ready]);

  return ready;
}
