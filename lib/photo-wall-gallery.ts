import { getAlbums, getAlbumPhotos } from "@/app/api/albums";
import type { Album } from "@/components/photos/AlbumCard";
import { articleCoverAlbum } from "@/data/article-covers";
import { gameAlbums } from "@/data/game-gallery";
import { localAnimePhotos, type Photo } from "@/data/photos";

export const builtinPhotoWallAlbums: Album[] = [articleCoverAlbum, ...gameAlbums];
export const fallbackPhotoWallAlbums: Album[] = [...builtinPhotoWallAlbums, {
  id: -1,
  title: "动漫图片",
  updatedAt: "2026-10-01T00:00:00+08:00",
  photoCount: localAnimePhotos.length,
  photos: localAnimePhotos,
}];

// The wall and cover picker use the same album order, photos and empty fallback.
export async function loadPhotoWallAlbums(): Promise<Album[]> {
  const albums = [...await getAlbums()].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (!albums.length) return fallbackPhotoWallAlbums;
  const personal = await Promise.all(albums.map(async (album): Promise<Album> => ({
    id: album.id,
    title: album.title,
    updatedAt: album.updated_at,
    photoCount: album.photo_count,
    photos: [...await getAlbumPhotos(album.id)].reverse().map((photo) => ({
      id: String(photo.id),
      url: photo.url,
      caption: photo.caption,
      orientation: (photo.orientation as Photo["orientation"]) || "landscape",
    })),
  })));
  return [...builtinPhotoWallAlbums, ...personal];
}
