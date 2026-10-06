import { request } from "./client";
import { readPublishedIndex } from "@/lib/published-content";

export interface BookmarkSite {
  id: number;
  category_id: number;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string[];
  sort: number;
  created_at: string;
}

export interface BookmarkCategory {
  id: number;
  name: string;
  icon: string;
  description: string;
  sort: number;
  created_at: string;
  sites: BookmarkSite[];
}

export function getBookmarks() {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedIndex().then((index) => index.bookmarks as unknown as BookmarkCategory[]);
  return request<BookmarkCategory[]>("/api/bookmarks");
}
