import { fetch, ProxyAgent } from "undici";

export interface WallpaperRecord {
  id: string;
  path: string;
  url: string;
  dimension_x: number;
  dimension_y: number;
  file_size: number;
  purity: string;
}

type CachedPage = { images: WallpaperRecord[]; lastPage?: number; expiresAt: number };
type Pool = Map<number, CachedPage>;

const pools = new Map<string, Pool>();
const pending = new Map<string, Promise<CachedPage>>();
const MAX_PAGES = 20;
const INITIAL_PAGES = 3;
const MIN_CANDIDATES = 12;
const TTL_MS = 10 * 60 * 1000;
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxy = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

function validImage(value: Partial<WallpaperRecord>): value is WallpaperRecord {
  return typeof value.id === "string" && typeof value.path === "string" && /\.(jpg|png)$/.test(value.path) &&
    typeof value.url === "string" && value.purity === "sfw" &&
    typeof value.file_size === "number" && value.file_size > 0 && value.file_size <= 8 * 1024 * 1024 &&
    typeof value.dimension_x === "number" && value.dimension_x > 0 &&
    typeof value.dimension_y === "number" && value.dimension_y > 0;
}

async function loadPage(url: URL, key: string, page: number): Promise<CachedPage> {
  const pendingKey = `${key}:${page}`;
  const existing = pending.get(pendingKey);
  if (existing) return existing;
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("page", String(page));
  const promise = (async () => {
    const response = await fetch(requestUrl.toString(), {
      ...(proxy ? { dispatcher: proxy } : {}),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Wallhaven ${response.status}`);
    const result = await response.json() as { data?: Partial<WallpaperRecord>[]; meta?: { last_page?: number } };
    const images = result.data?.filter(validImage) ?? [];
    return {
      images,
      lastPage: typeof result.meta?.last_page === "number" ? result.meta.last_page : images.length === 0 ? page : undefined,
      expiresAt: Date.now() + TTL_MS,
    };
  })();
  pending.set(pendingKey, promise);
  try { return await promise; }
  finally { pending.delete(pendingKey); }
}

export async function chooseWallpaper(
  key: string,
  query: URL,
  accepts: (image: WallpaperRecord) => boolean,
  seenIds: string[],
): Promise<WallpaperRecord> {
  let pool = pools.get(key);
  if (!pool) { pool = new Map(); pools.set(key, pool); }
  const seen = new Set(seenIds);
  const refreshExpired = (page: number) => {
    const cached = pool!.get(page);
    return !cached || cached.expiresAt <= Date.now();
  };
  const candidates = () => [...new Map([...pool!.values()].flatMap((item) => item.images)
    .filter(accepts).map((image) => [image.id, image])).values()];

  let lastPage = MAX_PAGES;
  for (let page = 1; page <= INITIAL_PAGES && page <= lastPage; page++) {
    if (refreshExpired(page)) {
      try { pool.set(page, await loadPage(query, key, page)); }
      catch { /* Use any successful pages already in the pool. */ }
    }
    const knownLastPage = pool.get(page)?.lastPage;
    if (knownLastPage !== undefined) lastPage = Math.min(lastPage, knownLastPage);
  }

  let all = candidates();
  let unseen = all.filter((image) => !seen.has(image.id));
  for (let page = INITIAL_PAGES + 1; unseen.length < MIN_CANDIDATES && page <= MAX_PAGES && page <= lastPage; page++) {
    if (refreshExpired(page)) {
      try { pool.set(page, await loadPage(query, key, page)); }
      catch { break; }
    }
    const loadedPage = pool.get(page);
    if (loadedPage?.lastPage !== undefined) lastPage = Math.min(lastPage, loadedPage.lastPage);
    all = candidates();
    unseen = all.filter((image) => !seen.has(image.id));
  }

  if (unseen.length) return unseen[Math.floor(Math.random() * unseen.length)];
  if (!all.length) throw new Error("No matching wallpapers");

  // A finite source can be exhausted. Reuse its least recently seen eligible image.
  const seenOrder = new Map(seenIds.map((id, index) => [id, index]));
  const leastRecent = all.filter((image) => seen.has(image.id))
    .sort((a, b) => (seenOrder.get(b.id) ?? -1) - (seenOrder.get(a.id) ?? -1));
  const newestId = seenIds[0];
  const avoidingNewest = leastRecent.filter((image) => image.id !== newestId);
  return (avoidingNewest[0] ?? leastRecent[0] ?? all[0]);
}

export function parseSeenIds(requestUrl: URL): string[] {
  const raw = requestUrl.searchParams.get("seen") ?? requestUrl.searchParams.get("exclude") ?? "";
  return [...new Set(raw.split(",").filter((id) => /^[a-zA-Z0-9]+$/.test(id)))].slice(0, 600);
}
