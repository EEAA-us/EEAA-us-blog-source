import defaults from "@/public/hero-media-defaults.json";

export interface MediaCategory { id: string; name: string; order: number; enabled: boolean }
export interface MediaItem {
  id: string; name: string; category: string; kind: "video" | "gif";
  url: string; poster: string; author?: string; sourceUrl?: string; licenseUrl?: string;
  order: number; enabled: boolean;
}
export interface MediaCatalog { version: 1; categories: MediaCategory[]; items: MediaItem[] }
export const defaultMediaCatalog = defaults as MediaCatalog;

function safeUrl(value: unknown, optional = false): boolean {
  if (optional && (value === undefined || value === null || value === "")) return true;
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || /[\\\x00-\x1f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !!url.hostname; } catch { return false; }
}

export function readMediaCatalog(value: unknown): MediaCatalog {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) return defaultMediaCatalog;
    const validEntry = (entry: MediaCategory | MediaItem) => entry && typeof entry.id === "string" && !!entry.id && typeof entry.name === "string" && !!entry.name.trim() && typeof entry.enabled === "boolean" && Number.isInteger(entry.order) && entry.order >= 0;
    if (parsed.categories.length > 50 || parsed.items.length > 200 || parsed.categories.some((c: MediaCategory) => !validEntry(c)) ||
      parsed.items.some((i: MediaItem) => !validEntry(i) || !safeUrl(i.url) || !safeUrl(i.poster, true) || !safeUrl(i.sourceUrl, true) || !safeUrl(i.licenseUrl, true) || (i.kind !== "video" && i.kind !== "gif"))) return defaultMediaCatalog;
    const categoryIds = new Set(parsed.categories.map((c: MediaCategory) => c.id));
    if (categoryIds.size !== parsed.categories.length || new Set(parsed.items.map((i: MediaItem) => i.id)).size !== parsed.items.length || parsed.items.some((i: MediaItem) => !categoryIds.has(i.category))) return defaultMediaCatalog;
    return parsed as MediaCatalog;
  } catch { return defaultMediaCatalog; }
}

export function visibleMediaCatalog(catalog: MediaCatalog): MediaCatalog {
  const categories = catalog.categories.filter(item => item.enabled).toSorted((a, b) => a.order - b.order);
  const ids = new Set(categories.map(item => item.id));
  return { version: 1, categories, items: catalog.items.filter(item => item.enabled && ids.has(item.category)).toSorted((a, b) => a.order - b.order) };
}
