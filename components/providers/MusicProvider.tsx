"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { siteConfig } from "@/siteConfig";
import { getSiteConfig } from "@/app/api/site-config";
import { loadMusicPlaylist } from "@/lib/music-load";
import { getAutomaticFailureNextIndex, getEndedTransition, type PlayMode } from "@/lib/music-playback.mjs";

function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];
  const result: { time: number; text: string }[] = [];
  for (const line of lrcText.split(/\r?\n/)) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    const text = line.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, "").replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\ufeff]/g, "").trim();
    if (!text) continue;
    for (const match of matches) {
      const fraction = match[3] ? Number(match[3]) / (match[3].length === 3 ? 1000 : 100) : 0;
      result.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

interface Song { id: string; title: string; artist: string; cover: string; src: string; lrcUrl: string; lyrics: { time: number; text: string }[] }
interface MusicContextType {
  playlist: Song[]; currentIndex: number; currentSong: Song | undefined; isPlaying: boolean;
  progress: number; currentTime: number; duration: number; currentLyric: string;
  allLyrics: { time: number; text: string }[]; lyricsStatus: "loading" | "ready" | "empty" | "error";
  playbackError: string; isLoading: boolean; volume: number; isMuted: boolean; playMode: PlayMode;
  playlistStatus: "loading" | "ready" | "empty" | "unconfigured" | "error"; retryPlaylist: () => void;
  saying: string; refreshSaying: () => void; togglePlay: () => void; nextSong: () => void;
  prevSong: () => void; handleSeek: (value: number) => void; playSong: (index: number) => void;
  setVolume: (value: number) => void; toggleMute: () => void; togglePlayMode: () => void; setPlayMode: (mode: PlayMode) => void;
}
const MusicContext = createContext<MusicContextType | null>(null);
const PLAY_ERROR = "这首歌暂时无法播放，请稍后重试或切换歌曲";

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("");
  const [lyricsStatus, setLyricsStatus] = useState<"loading" | "ready" | "empty" | "error">("empty");
  const [playbackError, setPlaybackError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [playlistStatus, setPlaylistStatus] = useState<MusicContextType["playlistStatus"]>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryPlaylist = useCallback(() => {
    setIsLoading(true);
    setPlaylistStatus("loading");
    setLoadAttempt(value => value + 1);
  }, []);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");
  const [saying, setSaying] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const modeRef = useRef(playMode);
  const playlistRef = useRef(playlist);
  const indexRef = useRef(currentIndex);
  const autoTriedRef = useRef(new Set<number>());
  const isAutoAdvanceRef = useRef(false);
  const isChangingTrackRef = useRef(false);
  const advanceRef = useRef<(from: number) => void>(() => {});
  useEffect(() => { modeRef.current = playMode; }, [playMode]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);

  const refreshSaying = useCallback(() => {
    fetch("https://uapis.cn/api/v1/saying").then((r) => r.json()).then((d) => { if (d?.text) setSaying(d.text); }).catch(() => {});
  }, []);
  useEffect(() => { refreshSaying(); }, [refreshSaying]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    (async () => {
      try {
        const result = await loadMusicPlaylist(getSiteConfig, { playlistId: siteConfig.cloudMusicPlaylistId, musicIds: siteConfig.cloudMusicIds }, controller.signal);
        if (mounted) { setPlaylist(result.songs); setCurrentIndex(0); setPlaylistStatus(result.status); }
      } catch { if (mounted) setPlaylistStatus("error"); }
      finally { if (mounted) setIsLoading(false); }
    })();
    return () => { mounted = false; controller.abort(); };
  }, [loadAttempt]);

  useEffect(() => {
    const song = playlistRef.current[currentIndex];
    if (!song) return;
    let mounted = true;
    // Reset the previous song's presentation as soon as the selected track changes.
    setLyrics([]); setCurrentLyric(""); setPlaybackError(""); setLyricsStatus(song.lrcUrl ? "loading" : "empty");
    if (song.lrcUrl) fetch(song.lrcUrl, { signal: AbortSignal.timeout(15000) })
      .then((r) => { if (!r.ok) throw new Error("Lyrics unavailable"); return r.text(); })
      .then((text) => {
        if (!mounted) return;
        const parsed = parseLrc(text); setLyrics(parsed); setLyricsStatus(parsed.length ? "ready" : "empty");
        setPlaylist((prev) => prev.map((entry, i) => i === currentIndex ? { ...entry, lyrics: parsed } : entry));
      }).catch(() => { if (mounted) setLyricsStatus("error"); });
    return () => { mounted = false; };
  }, [currentIndex, playlist.length]); // playlist contents are intentionally read for the selected index only.

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);
  useEffect(() => {
    if (!isPlaying || !playlistRef.current[currentIndex] || !audioRef.current) return;
    let active = true;
    audioRef.current.play().catch(() => {
      if (!active) return;
      if (isAutoAdvanceRef.current && (modeRef.current === "loop" || modeRef.current === "random")) advanceRef.current(currentIndex);
      else { isChangingTrackRef.current = false; setIsPlaying(false); setPlaybackError(PLAY_ERROR); }
    });
    return () => { active = false; };
  }, [currentIndex, isPlaying, playlist.length]);

  const advanceAutomatically = useCallback((from: number) => {
    const songs = playlistRef.current;
    if (!songs.length) { setIsPlaying(false); return; }
    setPlaybackError(PLAY_ERROR);
    const tried = autoTriedRef.current;
    if (tried.has(from)) return;
    tried.add(from);
    if (tried.size >= songs.length) {
      setIsPlaying(false); isAutoAdvanceRef.current = false;
      setPlaybackError("歌单中的歌曲目前都无法播放"); return;
    }
    const next = getAutomaticFailureNextIndex(modeRef.current, from, songs.length, tried);
    if (next === null) { setIsPlaying(false); isAutoAdvanceRef.current = false; return; }
    isAutoAdvanceRef.current = true;
    setIsPlaying(true);
    setPlaybackError(PLAY_ERROR);
    isChangingTrackRef.current = true;
    setCurrentIndex(next);
  }, []);
  useEffect(() => { advanceRef.current = advanceAutomatically; }, [advanceAutomatically]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError("");
    if (isPlaying) audio.pause();
    else {
      autoTriedRef.current.clear(); isAutoAdvanceRef.current = false;
      if (audio.error) audio.load();
      audio.play().catch(() => { setIsPlaying(false); setPlaybackError(PLAY_ERROR); });
    }
  }, [isPlaying]);

  const nextSong = useCallback(() => {
    if (!playlist.length) return;
    autoTriedRef.current.clear(); isAutoAdvanceRef.current = false; setPlaybackError("");
    if (playMode === "random") {
      const candidates = playlist.map((_, i) => i).filter((i) => i !== currentIndex);
      const next = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : currentIndex;
      isChangingTrackRef.current = isPlaying && next !== currentIndex;
      setCurrentIndex(next);
    } else {
      const next = (currentIndex + 1) % playlist.length;
      isChangingTrackRef.current = isPlaying && next !== currentIndex;
      setCurrentIndex(next);
    }
  }, [currentIndex, isPlaying, playMode, playlist]);

  const prevSong = useCallback(() => {
    if (!playlist.length) return;
    autoTriedRef.current.clear(); isAutoAdvanceRef.current = false; setPlaybackError("");
    const next = playMode === "random"
      ? Math.floor(Math.random() * playlist.length)
      : (currentIndex - 1 + playlist.length) % playlist.length;
    isChangingTrackRef.current = isPlaying && next !== currentIndex;
    setCurrentIndex(next);
  }, [currentIndex, isPlaying, playMode, playlist.length]);

  const playSong = useCallback((index: number) => {
    if (index < 0 || index >= playlist.length) return;
    autoTriedRef.current.clear(); isAutoAdvanceRef.current = false; setPlaybackError("");
    if (index === currentIndex && audioRef.current) {
      if (audioRef.current.error) audioRef.current.load();
      audioRef.current.play().catch(() => { setIsPlaying(false); setPlaybackError(PLAY_ERROR); });
      return;
    }
    isChangingTrackRef.current = true;
    setCurrentIndex(index); setIsPlaying(true);
  }, [currentIndex, playlist.length]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current; if (!audio) return;
    const ct = audio.currentTime; const dur = audio.duration || 0;
    setCurrentTime(ct); setDuration(dur); setProgress(dur > 0 ? ct / dur * 100 : 0);
    if (lyrics.length) { const active = [...lyrics].reverse().find((line) => ct >= line.time); if (active) setCurrentLyric(active.text); }
  }, [lyrics]);

  const handleEnded = useCallback(() => {
    const songs = playlistRef.current;
    if (!songs.length) { setIsPlaying(false); return; }
    const transition = getEndedTransition(modeRef.current, indexRef.current, songs.length);
    if (transition.type === "stop") {
      setIsPlaying(false); isAutoAdvanceRef.current = false; isChangingTrackRef.current = false;
      return;
    }
    if (transition.type === "repeat" && audioRef.current) {
      autoTriedRef.current.clear(); isAutoAdvanceRef.current = false; setPlaybackError("");
      isChangingTrackRef.current = false;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { setIsPlaying(false); setPlaybackError(PLAY_ERROR); });
      return;
    }
    if (transition.type !== "advance") return;
    autoTriedRef.current.clear(); setPlaybackError("");
    isAutoAdvanceRef.current = modeRef.current === "loop" || modeRef.current === "random";
    isChangingTrackRef.current = true;
    setIsPlaying(true);
    setCurrentIndex(transition.index);
  }, []);

  const handleAudioError = useCallback(() => {
    setIsPlaying(false); setPlaybackError(PLAY_ERROR);
    isChangingTrackRef.current = false;
    if (isAutoAdvanceRef.current && (modeRef.current === "loop" || modeRef.current === "random")) advanceRef.current(indexRef.current);
    else isAutoAdvanceRef.current = false;
  }, []);
  const handleSeek = useCallback((value: number) => {
    setProgress(value); if (audioRef.current?.duration) audioRef.current.currentTime = value / 100 * audioRef.current.duration;
  }, []);
  const setVolume = useCallback((value: number) => { setVolumeState(Math.min(1, Math.max(0, value))); if (value > 0) setIsMuted(false); }, []);
  const toggleMute = useCallback(() => setIsMuted((prev) => !prev), []);
  const togglePlayMode = useCallback(() => {
    const modes: PlayMode[] = ["once", "single", "random", "loop"];
    setPlayMode((mode) => modes[(modes.indexOf(mode) + 1) % modes.length]);
  }, []);

  return <MusicContext.Provider value={{
    playlist, currentIndex, currentSong: playlist[currentIndex], isPlaying, progress, currentTime, duration,
    currentLyric, allLyrics: lyrics, lyricsStatus, playbackError, isLoading, playlistStatus, retryPlaylist, volume, isMuted, playMode,
    saying, refreshSaying, togglePlay, nextSong, prevSong, handleSeek, playSong, setVolume, toggleMute, togglePlayMode, setPlayMode,
  }}>
    {children}
    {playlist[currentIndex] && <audio ref={audioRef} src={playlist[currentIndex].src} onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded} onLoadedMetadata={handleTimeUpdate} onPlaying={() => { setIsPlaying(true); autoTriedRef.current.clear(); isAutoAdvanceRef.current = false; isChangingTrackRef.current = false; setPlaybackError(""); }}
      onPause={() => { if (!isChangingTrackRef.current) setIsPlaying(false); }} onError={handleAudioError} />}
  </MusicContext.Provider>;
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}
