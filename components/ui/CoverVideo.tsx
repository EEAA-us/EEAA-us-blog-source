"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { siteConfig } from "@/siteConfig";
import { coverVideoSource } from "@/lib/cover-video-source";
import { useDocumentVisible } from "./useDocumentVisible";

function subscribeToVideoSize(change: () => void) {
  const queries = [window.matchMedia("(max-width: 1024px)"), window.matchMedia("(max-width: 1920px)")];
  queries.forEach(query => query.addEventListener("change", change));
  return () => queries.forEach(query => query.removeEventListener("change", change));
}

export default function CoverVideo(props: { src: string; poster: string; playing: boolean }) {
  const size = useSyncExternalStore(subscribeToVideoSize, () =>
    window.matchMedia("(max-width: 1024px)").matches ? 1024 : window.matchMedia("(max-width: 1920px)").matches ? 1920 : 3840, () => 0);
  const documentVisible = useDocumentVisible();
  const [failedVariant, setFailedVariant] = useState(false);
  const selected = coverVideoSource(props.src, size, siteConfig.heroVideoVariants);
  const src = failedVariant ? props.src : selected;
  // Hydration first resolves the viewport, avoiding a request for the large original.
  return size > 0 ? <AnimatedVideo key={src} {...props} src={src} playing={props.playing && documentVisible}
    onFailure={() => { if (src !== props.src) setFailedVariant(true); }} /> : null;
}

function AnimatedVideo({ src, poster, playing, onFailure }: { src: string; poster: string; playing: boolean; onFailure: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [attached, setAttached] = useState(playing);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  // Remember the first activation without a post-paint effect or detaching on pause.
  if (playing && !attached) setAttached(true);
  const sourceReady = playing || attached;
  useEffect(() => {
    const video = ref.current;
    if (!video || !sourceReady || failed) return;
    const sync = () => {
      if (playing) void video.play().catch(() => {});
      else video.pause();
    };
    // play() queues playback while buffering; do not wait for window.load/idle/canplay.
    sync();
    video.addEventListener("canplay", sync);
    document.addEventListener("cover-media-attached", sync);
    return () => {
      video.removeEventListener("canplay", sync);
      document.removeEventListener("cover-media-attached", sync);
    };
  }, [playing, sourceReady, failed]);
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={poster} alt="" className="home-cover-image" />
    <video ref={ref} src={sourceReady ? src : undefined} muted loop playsInline
      preload={playing && sourceReady ? "auto" : "none"} poster={poster}
      onPlaying={() => setStarted(true)} onError={() => { setFailed(true); onFailure(); }}
      className="home-cover-video" style={{ opacity: started && !failed ? 1 : 0 }} />
  </>;
}
