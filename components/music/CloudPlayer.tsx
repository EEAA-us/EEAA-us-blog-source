"use client";
import { useTranslation } from "@/lib/i18n";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMusic } from "@/components/providers/MusicProvider";
import MusicCover from "@/components/music/MusicCover";

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return "00:00";
  const m = Math.floor(time / 60).toString().padStart(2, "0");
  const s = Math.floor(time % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function CloudPlayer() {
  const { tx } = useTranslation();
  const router = useRouter();
  const {
    currentSong, isPlaying, progress, currentTime, duration, currentLyric, playbackError, lyricsStatus,
    togglePlay, nextSong, prevSong, handleSeek, isLoading, saying, refreshSaying,
    volume, isMuted, setVolume, toggleMute, playMode, setPlayMode, playlistStatus, retryPlaylist,
  } = useMusic();

  const [displayedLyric, setDisplayedLyric] = useState("");
  const prevLyricRef = useRef("");
  const charRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);


  // Typewriter effect for lyrics
  useEffect(() => {
    if (currentLyric === prevLyricRef.current) return;
    prevLyricRef.current = currentLyric;
    charRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDisplayedLyric("");

    if (!currentLyric) return;
    intervalRef.current = setInterval(() => {
      charRef.current++;
      if (charRef.current <= currentLyric.length) {
        setDisplayedLyric(currentLyric.slice(0, charRef.current));
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentLyric]);

  if (isLoading) {
    return (
      <div className="editorial-panel w-full p-6 flex items-center justify-center min-h-[240px]">
        <div className="text-sm text-slate-400 animate-pulse">{tx("加载音乐中...")}</div>
      </div>
    );
  }

  if (!currentSong) {
    return (
      <div
        onClick={() => router.push("/music")}
        className="editorial-panel w-full p-6 flex flex-col items-center justify-center gap-4 min-h-[240px] cursor-pointer transition-all duration-700 hover:scale-[1.02] group"
      >
        <svg className="w-10 h-10 text-indigo-400 dark:text-indigo-500 opacity-60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5 3.871 3.871 0 01-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5 3.871 3.871 0 01-2.748-1.179z" />
        </svg>
        <p
          className="text-sm text-slate-700 dark:text-slate-200 font-semibold text-center leading-relaxed tracking-wide"
          style={{ fontFamily: "Georgia, 'Noto Serif SC', serif" }}
        >
          {playlistStatus === "error" ? tx("音乐加载失败，请重试") : playlistStatus === "unconfigured" ? tx("站长尚未配置音乐") : tx("歌单暂无歌曲")}
        </p>
        {saying && <p className="text-xs text-slate-500 text-center">{saying}</p>}
        <button type="button" onClick={(e) => { e.stopPropagation(); retryPlaylist(); }} className="text-sm text-indigo-600">{tx("重新加载")}</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); refreshSaying(); }}
          title={tx("换一句")}
          className="text-xs text-slate-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          {tx("换一句")}
        </button>
      </div>
    );
  }

  const safeTogglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlay();
  };
  const safePrevSong = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    prevSong();
  };
  const safeNextSong = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    nextSong();
  };
  const safeHandleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    handleSeek(Number(e.target.value));
  };

  return (
    <>
      <style>{`
        .cloud-player-progress::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--ui-primary, #6366f1); cursor: pointer; transition: transform 0.1s; }
        .cloud-player-progress::-webkit-slider-thumb:hover { transform: scale(1.3); }
      `}</style>

      <div
        onClick={() => router.push("/music")}
        className="editorial-panel w-full p-5 flex flex-col justify-between transition-all duration-700 hover:scale-[1.02] relative group overflow-hidden cursor-pointer min-h-[240px]"
      >
        <div className={`absolute -top-20 -right-20 w-48 h-48 bg-sky-500/20 blur-[50px] rounded-full transition-opacity duration-1000 ${isPlaying ? "opacity-100" : "opacity-30"}`} />

        {/* Cover + Info */}
        <div className="flex items-center gap-3 md:gap-5 relative z-10 mb-3 md:mb-6 mt-1 md:mt-2">
          <div
            className="w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-white/50 shadow-lg flex-shrink-0 overflow-hidden relative"
            style={{ animation: isPlaying ? "spin 6s linear infinite" : "none" }}
          >
            <MusicCover src={currentSong.cover} alt="cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white/80 backdrop-blur-sm rounded-full border border-gray-300 shadow-inner" />
          </div>
          <div className="flex-col overflow-hidden w-full">
            <span className="theme-secondary-chip text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-sm">
              Cloud Music
            </span>
            <h3 className="text-base md:text-xl font-bold text-slate-900 dark:text-white truncate drop-shadow-sm mt-1">
              {currentSong.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 font-medium truncate drop-shadow-sm">
              {currentSong.artist}
            </p>
          </div>
        </div>

        {/* Lyric */}
        <div className="relative z-10 mb-2 h-6 overflow-hidden">
          <p className="text-xs font-bold text-sky-600 dark:text-sky-400 truncate">
            {playbackError ? tx(playbackError) : displayedLyric || tx(lyricsStatus === "loading" ? "歌词加载中…" : lyricsStatus === "error" ? "歌词暂时无法加载，请稍后重试" : !isPlaying ? "点击播放音乐" : lyricsStatus === "ready" ? "前奏中…" : "暂无歌词")}
            {isPlaying && <span className="inline-block w-[3px] h-4 bg-indigo-400 align-middle ml-1 animate-pulse" />}
          </p>
        </div>

        {/* Progress + Controls */}
        <div className="relative z-10 mt-auto">
          <div
            className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-bold mb-3"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range" min="0" max="100" value={progress} onChange={safeHandleSeek}
              title={tx("播放进度")}
              className="cloud-player-progress min-w-0 flex-1 h-1.5 rounded-full appearance-none cursor-pointer shadow-inner"
              style={{ background: `linear-gradient(to right, var(--ui-primary) ${progress}%, var(--ui-outline) ${progress}%)` }}
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-8">
            <button type="button" onClick={safePrevSong} title={tx("上一首")} className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative z-20">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
            </button>
            <button type="button" onClick={safeTogglePlay} title={tx(isPlaying ? "暂停" : "播放")} className="theme-primary-button w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all border-2 border-white/50 dark:border-slate-600 relative z-20">
              {isPlaying
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                : <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              }
            </button>
            <button type="button" onClick={safeNextSong} title={tx("下一首")} className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative z-20">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>
          <div className="relative z-20 mt-2 flex justify-center" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <select value={playMode} onChange={(e) => setPlayMode(e.target.value as typeof playMode)} title={tx("播放模式")} aria-label={tx("播放模式")} className="rounded-lg border border-slate-300/70 bg-white/50 px-2 py-1 text-xs text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
              <option value="once">{tx("仅播一首")}</option>
              <option value="single">{tx("单曲循环")}</option>
              <option value="random">{tx("随机播放")}</option>
              <option value="loop">{tx("顺序循环")}</option>
            </select>
          </div>
          <div className="relative z-20 mt-2 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={toggleMute} title={tx(isMuted ? "取消静音" : "静音")} aria-label={tx(isMuted ? "取消静音" : "静音")} className="hover:text-indigo-600 dark:hover:text-indigo-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z"/>{isMuted || volume === 0 ? <path strokeLinecap="round" d="m17 9 5 5m0-5-5 5"/> : <path strokeLinecap="round" d="M15 9a5 5 0 010 6"/>}</svg>
            </button>
            <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => setVolume(Number(e.target.value))} title={tx("音量")} aria-label={tx("音量")} className="w-24 h-1 accent-indigo-500 cursor-pointer" />
            <span className="w-9 tabular-nums text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
        </div>
      </div>
    </>
  );
}

