import { request } from "./client";
import { readPublishedSelection } from "@/lib/published-content";

export interface AlbumItem {
  id: number;
  title: string;
  description: string;
  cover: string;
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoItem {
  id: number;
  album_id: number;
  url: string;
  caption: string;
  orientation: string;
  sort: number;
  created_at: string;
}

export function getAlbums() {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedSelection(index => index.albums as unknown as AlbumItem[]);
  return request<AlbumItem[]>("/api/albums");
}

export function getAlbumById(albumId: number) {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedSelection((index) => {
    const album = index.albums.find((item) => item.id === albumId);
    if (!album) throw new Error("Album not found");
    return album as unknown as AlbumItem;
  });
  return request<AlbumItem>(`/api/albums/${albumId}`);
}

export function getAlbumPhotos(albumId: number) {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedSelection(index => (index.photos[String(albumId)] ?? []) as unknown as PhotoItem[]);
  return request<PhotoItem[]>(`/api/albums/${albumId}/photos`);
}
