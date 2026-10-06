const STORAGE_KEY = "wallpaper-history-v1";
const MAX_HISTORY = 2400;

export function getWallpaperHistory(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function rememberWallpaper(id: string): string[] {
  const history = [id, ...getWallpaperHistory().filter((item) => item !== id)].slice(0, MAX_HISTORY);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* Storage can be unavailable in private contexts. */ }
  return history;
}
