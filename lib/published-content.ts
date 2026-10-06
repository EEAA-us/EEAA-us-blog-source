export const isPublishedContentMode = process.env.NEXT_PUBLIC_CONTENT_MODE === "published";

export interface PublishedIndex {
  schemaVersion: 1;
  generatedAt: string;
  posts: Array<Record<string, unknown> & { id: number; slug: string; searchText: string }>;
  categories: Array<Record<string, unknown>>;
  albums: Array<Record<string, unknown>>;
  photos: Record<string, Array<Record<string, unknown>>>;
  bookmarks: Array<Record<string, unknown>>;
  chatters: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  siteConfig: Record<string, unknown>;
}

// Navigation consumers share the network/parse work, but own their returned data.
// A short lifetime lets open tabs discover a later publication without a reload.
let indexRequest: Promise<PublishedIndex> | null = null;
let indexFreshUntil = 0;

async function fetchPublishedIndex(): Promise<PublishedIndex> {
  const response = await fetch("/content/index.json", { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Published content unavailable (${response.status})`);
  const parsed = await response.json() as PublishedIndex;
  if (parsed.schemaVersion !== 1) throw new Error("Unsupported published content schema");
  return parsed;
}

export function readPublishedSelection<T>(select: (index: PublishedIndex) => T): Promise<T> {
  if (!indexRequest || Date.now() >= indexFreshUntil) {
    const request = fetchPublishedIndex();
    indexRequest = request;
    indexFreshUntil = Infinity;
    void request.then(() => {
      if (indexRequest === request) indexFreshUntil = Date.now() + 30_000;
    }, () => {
      if (indexRequest === request) { indexRequest = null; indexFreshUntil = 0; }
    });
  }
  // Photo consumers sort/reverse arrays, so sharing their mutable objects would
  // make a later visit change order. Keep the previous per-read ownership.
  return indexRequest.then((index) => structuredClone(select(index)));
}

export function readPublishedIndex(): Promise<PublishedIndex> {
  return readPublishedSelection(index => index);
}

export async function readPublishedPost(id: number): Promise<Record<string, unknown> | null> {
  const response = await fetch(`/content/posts/${id}.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Published article unavailable (${response.status})`);
  return response.json() as Promise<Record<string, unknown>>;
}
