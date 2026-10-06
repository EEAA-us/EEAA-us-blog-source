"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CoverMedia from "@/components/ui/CoverMedia";
import { siteConfig } from "@/siteConfig";

const CoverHostContext = createContext<HTMLDivElement | null>(null);

// The portal target stays the same across routes. Only its containing scene moves,
// so the slideshow and the actual video/GIF nodes keep their playback state.
export function CoverMediaProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const initialize = useCallback((parking: HTMLDivElement | null) => {
    if (!parking || hostRef.current) return;
    const next = document.createElement("div");
    next.className = "persistent-cover-host";
    hostRef.current = next;
    parking.appendChild(next);
    setHost(next);
  }, []);
  return <CoverHostContext.Provider value={host}>
    <div ref={initialize} hidden aria-hidden="true" />
    {children}
    {host && createPortal(<CoverMedia image={siteConfig.heroImage} />, host)}
  </CoverHostContext.Provider>;
}

export function CoverMediaSlot() {
  const host = useContext(CoverHostContext);
  const attach = useCallback((slot: HTMLDivElement | null) => {
    if (!slot || !host) return;
    slot.appendChild(host);
    host.dispatchEvent(new Event("cover-media-attached", { bubbles: true }));
  }, [host]);
  return <div ref={attach} className="persistent-cover-slot" />;
}
