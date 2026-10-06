import type { BookmarkCategory, BookmarkSite } from "@/app/api";

export type CuratedBookmark = BookmarkSite & {
  sourceUrl?: string;
};

export type CuratedBookmarkCategory = Omit<BookmarkCategory, "sites"> & {
  sites: CuratedBookmark[];
};

// Add site-specific bookmarks here if desired.
export const curatedBookmarkCategories: CuratedBookmarkCategory[] = [];

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim().replace(/\/+$/, "").toLowerCase();
  }
}

/** Keep server-managed bookmarks first, then add the local curated entries. */
export function mergeBookmarkCategories(
  backend: BookmarkCategory[],
): CuratedBookmarkCategory[] {
  const merged = backend.map((category) => ({
    ...category,
    sites: category.sites.map((item) => ({ ...item })),
  })) as CuratedBookmarkCategory[];
  const categoryByName = new Map(
    merged.map((category) => [category.name.trim().toLocaleLowerCase(), category]),
  );
  const seenUrls = new Set(merged.flatMap((category) => category.sites.map((item) => normalizedUrl(item.url))));

  for (const curated of curatedBookmarkCategories) {
    const key = curated.name.trim().toLocaleLowerCase();
    let target = categoryByName.get(key);
    if (!target) {
      target = { ...curated, sites: [] };
      merged.push(target);
      categoryByName.set(key, target);
    }
    for (const item of curated.sites) {
      const normalized = normalizedUrl(item.url);
      if (seenUrls.has(normalized)) continue;
      target.sites.push({ ...item, category_id: target.id });
      seenUrls.add(normalized);
    }
  }

  return merged.filter((category) => category.sites.length > 0);
}
