"use client";
import { useTranslation } from "@/lib/i18n";

import { useState, useEffect, useRef } from "react";
import { useMusic } from "@/components/providers/MusicProvider";

export default function LyricBar() {
  const { tx } = useTranslation();
  const { isPlaying, currentLyric, currentSong, saying, refreshSaying } = useMusic();
  const [displayedText, setDisplayedText] = useState("");
  const prevTextRef = useRef("");
  const charRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine the target text: lyrics when playing, saying when paused
  const targetText = isPlaying ? currentLyric : saying;

  // Typewriter effect
  useEffect(() => {
    if (targetText === prevTextRef.current) return;
    prevTextRef.current = targetText;
    charRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDisplayedText("");

    if (!targetText) return;
    intervalRef.current = setInterval(() => {
      charRef.current++;
      if (charRef.current <= targetText.length) {
        setDisplayedText(targetText.slice(0, charRef.current));
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [targetText]);

  if (!currentSong) return null;

  const waves = [
    { color: "bg-indigo-400", delay: "0ms" },
    { color: "bg-purple-400", delay: "200ms" },
    { color: "bg-indigo-500", delay: "400ms" },
    { color: "bg-purple-500", delay: "100ms" },
    { color: "bg-indigo-300", delay: "300ms" },
  ];

  return (
    <>
      <style>{`
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-cursor { animation: cursorBlink 0.8s step-end infinite; }
        @keyframes safeWave { 0%, 100% { height: 8px; } 50% { height: 28px; } }
        .safe-wave-active { animation: safeWave 1s ease-in-out infinite; }
      `}</style>

      <div
        aria-label={tx("歌词与随想")}
        title={targetText}
        className="lyric-bar w-full min-w-0 overflow-hidden rounded-2xl bg-slate-900/80 dark:bg-slate-950/90 backdrop-blur-xl border border-white/10 p-4 flex items-center gap-3 min-h-24"
        onClick={() => { if (!isPlaying && saying) refreshSaying(); }}
      >
        {/* Waveform */}
        <div aria-hidden="true" className="flex shrink-0 items-end justify-center gap-0.5 h-8 w-6">
          {waves.map((wave, i) => (
            <div
              key={i}
              className={`w-1 rounded-t-sm transition-all duration-500 ease-out ${
                isPlaying ? `${wave.color} safe-wave-active` : "h-1 bg-slate-600"
              }`}
              style={{ animationDelay: wave.delay, height: isPlaying ? undefined : "4px" }}
            />
          ))}
        </div>

        {/* Lyric / Saying */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="mb-1 block text-[10px] text-indigo-200/70">{tx(isPlaying ? "歌词" : "随想")}</span>
          <p className="line-clamp-2 break-words text-white text-sm font-medium leading-6 tracking-normal">
            {displayedText || (isPlaying ? "♪ ♪" : saying || tx("点击换一句随想"))}
            <span aria-hidden="true" className="inline-block w-0.5 h-4 bg-indigo-400 align-middle ml-1 animate-cursor" />
          </p>
        </div>

        {/* Music icon */}
        <div aria-hidden="true" className="w-4 shrink-0 flex justify-end">
          <svg
            className={`w-4 h-4 text-indigo-400/50 transition-all duration-500 ${isPlaying ? "animate-bounce" : "opacity-30"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      </div>
    </>
  );
}
