export interface LoadedSong {
  id: string; title: string; artist: string; cover: string; src: string; lrcUrl: string;
  lyrics: { time: number; text: string }[];
}

// Bound the entire initialization, including configuration and JSON parsing.
export async function loadMusicPlaylist(
  readConfig: (signal: AbortSignal) => Promise<Record<string, unknown>>,
  defaults: { playlistId: string; musicIds: readonly string[] },
  signal: AbortSignal,
  timeoutMs = 15_000,
): Promise<{ status: "ready" | "empty" | "unconfigured"; songs: LoadedSong[] }> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  let cancel: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => reject(bounded.reason);
    if (bounded.aborted) cancel();
    else bounded.addEventListener("abort", cancel, { once: true });
  });
  try {
    return await Promise.race([cancelled, (async () => {
      const config = await readConfig(bounded);
      const playlistId = typeof config.cloud_music_playlist_id === "string" ? config.cloud_music_playlist_id : defaults.playlistId;
      const parsed: unknown = typeof config.cloud_music_ids === "string" ? (config.cloud_music_ids.trim() ? JSON.parse(config.cloud_music_ids) : []) : defaults.musicIds;
      if (!Array.isArray(parsed) || parsed.some(id => typeof id !== "string")) throw new Error("Invalid music configuration");
      const apiUrl = playlistId ? `/api/music?id=${encodeURIComponent(playlistId)}` : parsed.length ? `/api/music?ids=${encodeURIComponent(parsed.join(","))}` : "";
      if (!apiUrl) return { status: "unconfigured" as const, songs: [] };
      bounded.throwIfAborted();
      const response = await fetch(apiUrl, { signal: bounded });
      if (!response.ok) throw new Error("Playlist unavailable");
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid playlist response");
      const songs = data.map((row: Record<string, unknown>) => ({
        id: String(row.id || ""), title: String(row.title || row.name || "未知歌曲"),
        artist: String(row.artist || row.author || "未知歌手"), cover: String(row.cover || row.pic || ""),
        src: String(row.src || row.url || ""), lrcUrl: String(row.lrcUrl || row.lrc || ""), lyrics: [],
      })).filter(song => song.id && song.src);
      return { status: songs.length ? "ready" as const : "empty" as const, songs };
    })()]);
  } finally {
    bounded.removeEventListener("abort", cancel);
  }
}
