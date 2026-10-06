"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { findActiveHeading } from "@/lib/article-scroll";

export type ArticleHeading = { id: string; text: string; level: number };

export function useArticleHeadings(
  contentRef: RefObject<HTMLElement | null>,
  contentKey: string,
  idPrefix = "heading",
) {
  const [headings, setHeadings] = useState<ArticleHeading[]>([]);
  const [activeId, setActiveId] = useState("");
  const navigationTarget = useRef<string | null>(null);

  const scrollToHeading = useCallback((id: string) => {
    const heading = Array.from(contentRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3") ?? [])
      .find((element) => element.id === id);
    if (!heading) return;
    navigationTarget.current = id;
    setActiveId(id);
    window.history.replaceState(window.history.state, "", `#${encodeURIComponent(id)}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || Boolean(heading.closest('[data-reduce-motion="true"]'));
    window.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top + window.scrollY - 88), behavior: reduceMotion ? "instant" : "smooth" });
  }, [contentRef]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) {
      const frame = window.requestAnimationFrame(() => {
        setHeadings([]);
        setActiveId("");
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const elements = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3"));
    elements.forEach((heading, index) => {
      heading.id ||= `${idPrefix}-${index}`;
    });
    navigationTarget.current = null;

    let offsets: number[] = [];
    let needsMeasurement = true;
    let active = true;
    let pendingFrame: number | null = null;
    let settledTimer: number | undefined;
    const updateActiveHeading = () => {
      pendingFrame = null;
      if (needsMeasurement) {
        offsets = elements.map((heading) => heading.getBoundingClientRect().top + window.scrollY);
        needsMeasurement = false;
      }
      if (navigationTarget.current) return;
      const index = findActiveHeading(offsets, window.scrollY + 100);
      setActiveId(elements[index]?.id ?? "");
    };
    const scheduleUpdate = () => {
      if (pendingFrame === null) pendingFrame = window.requestAnimationFrame(updateActiveHeading);
    };
    const invalidateLayout = () => { needsMeasurement = true; scheduleUpdate(); };
    const onLayoutChange = () => {
      invalidateLayout();
      // Re-measure once after the existing 300ms panel transition settles.
      window.clearTimeout(settledTimer);
      settledTimer = window.setTimeout(invalidateLayout, 320);
    };
    const observer = new ResizeObserver(invalidateLayout);
    observer.observe(root);
    void document.fonts.ready.then(() => { if (active) invalidateLayout(); });
    let frame: number | null = null;
    let outlineReady = false;
    // The article is already readable. Build the outline with settled font
    // metrics so its wrapped labels and deep links do not jump during font swap.
    const publishOutline = () => {
      if (!active || outlineReady) return;
      outlineReady = true;
      frame = window.requestAnimationFrame(() => {
        setHeadings(elements.map((heading) => ({
          id: heading.id,
          text: heading.textContent?.trim() || "未命名章节",
          level: Number(heading.tagName.slice(1)),
        })));
        const hash = window.location.hash.slice(1);
        const target = elements.find((heading) => encodeURIComponent(heading.id) === hash || heading.id === hash);
        if (target) scrollToHeading(target.id);
        else updateActiveHeading();
      });
    };
    // A slow font must not indefinitely hide reading navigation.
    const outlineTimer = window.setTimeout(publishOutline, 1500);
    void document.fonts.ready.then(publishOutline);
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("a, button")) return;
      const heading = event.target.closest<HTMLElement>("h1, h2, h3");
      if (heading && root.contains(heading)) scrollToHeading(heading.id);
    };
    const onManualScroll = () => { navigationTarget.current = null; scheduleUpdate(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) onManualScroll();
    };
    root.addEventListener("click", onClick);
    root.addEventListener("load", invalidateLayout, true);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", invalidateLayout);
    window.addEventListener("reading-layout-change", onLayoutChange);
    window.addEventListener("wheel", onManualScroll, { passive: true });
    window.addEventListener("touchstart", onManualScroll, { passive: true });
    window.addEventListener("pointerdown", onManualScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.clearTimeout(outlineTimer);
      active = false;
      observer.disconnect();
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
      window.clearTimeout(settledTimer);
      root.removeEventListener("click", onClick);
      root.removeEventListener("load", invalidateLayout, true);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", invalidateLayout);
      window.removeEventListener("reading-layout-change", onLayoutChange);
      window.removeEventListener("wheel", onManualScroll);
      window.removeEventListener("touchstart", onManualScroll);
      window.removeEventListener("pointerdown", onManualScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contentRef, contentKey, idPrefix, scrollToHeading]);

  useEffect(() => {
    contentRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((heading) => {
      heading.classList.toggle("article-active-heading", heading.id === activeId);
    });
  }, [activeId, contentKey, contentRef]);

  return { headings, activeId, scrollToHeading };
}
