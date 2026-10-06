import { request } from "./client";
import { readPublishedIndex } from "@/lib/published-content";

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort: number;
  post_count: number;
}

export function getCategories() {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedIndex().then((index) => index.categories as unknown as CategoryItem[]);
  return request<CategoryItem[]>("/api/categories");
}
