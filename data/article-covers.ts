import coverSources from "@/public/images/article-covers/sources.json";
import type { Photo } from "@/data/photos";
import type { Album } from "@/components/photos/AlbumCard";
import { siteConfig } from "@/siteConfig";

// Fixed 60-slot pool, selected by cycling through slots by post ID. Keeping
// the slot order preserves existing default covers; changing the count or
// order can change which cover older posts receive.
const ARTICLE_COVER_SLOTS = 60;

interface CoverSource {
  id: string; url: string; caption: string; width: number; height: number; sourceUrl?: string;
}
const sourcePhotos = coverSources.photos as CoverSource[];

export const articleCoverPhotos: Photo[] = sourcePhotos.map((photo) => ({
  id: photo.id,
  url: photo.url,
  caption: photo.caption,
  orientation: photo.width > photo.height ? "landscape" : photo.width === photo.height ? "square" : "portrait",
  sourceUrl: photo.sourceUrl,
  width: photo.width,
  height: photo.height,
}));

export function getArticleCover(post: { id: number; cover?: string | null }): string {
  if (post.cover?.trim()) return post.cover;
  const articleId = Math.abs(Math.trunc(post.id));
  const slot = ((articleId - 1) % ARTICLE_COVER_SLOTS + ARTICLE_COVER_SLOTS) % ARTICLE_COVER_SLOTS;
  return articleCoverPhotos[slot]?.url ?? articleCoverPhotos[0]?.url ?? siteConfig.defaultPostCover;
}

export const articleCoverAlbum: Album = {
  id: -14,
  title: "文章封面库",
  updatedAt: "2026-10-02T00:00:00+08:00",
  photoCount: articleCoverPhotos.length,
  photos: articleCoverPhotos,
};
