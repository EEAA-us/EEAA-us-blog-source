"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export function usePageNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { preferences, reducedMotion } = useAppearance();
  const pending = useRef<string | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (pending.current !== pathname) return;
    pending.current = null;
    let frame = 0;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (pathname === "/") return;
    const locate = () => {
      const content = document.getElementById("page-content");
      if (!content) return;
      observer?.disconnect();
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const top = Math.max(0, content.getBoundingClientRect().top + window.scrollY - 80);
          window.scrollTo({ top, behavior: preferences.navigationScroll === "smooth" && !reducedMotion ? "smooth" : "instant" });
        });
      });
    };
    const observer = new MutationObserver(locate);
    observer.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
    locate();
    const timeout = window.setTimeout(() => observer?.disconnect(), 8000);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.clearTimeout(timeout); };
  }, [pathname, request, preferences.navigationScroll, reducedMotion]);

  return (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pending.current = path;
    if (pathname === path) setRequest((value) => value + 1);
    else router.push(path, { scroll: false });
  };
}
