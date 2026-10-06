import { http } from "@/utils/http";

export type SiteConfigItem = {
  id: number;
  key: string;
  value: string;
  description: string;
  updated_at: string;
};

export type MediaCatalogCategory = {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
};

export type MediaCatalogItem = {
  id: string;
  name: string;
  category: string;
  kind: "video" | "gif";
  url: string;
  poster: string;
  author?: string;
  sourceUrl?: string;
  licenseUrl?: string;
  order: number;
  enabled: boolean;
};

export type MediaCatalog = {
  version: 1;
  categories: MediaCatalogCategory[];
  items: MediaCatalogItem[];
};

export type ProjectCovers = { covers: Record<string, string> };

export const getProjectCovers = () =>
  http.request<ProjectCovers>("get", "/api/site-config/project-covers");

export const saveProjectCovers = (data: ProjectCovers) =>
  http.request<ProjectCovers>("put", "/api/site-config/project-covers", {
    data
  });

/** 获取动态封面素材目录 */
export const getMediaCatalog = () =>
  http.request<MediaCatalog>("get", "/api/site-config/media-catalog");

/** 保存完整动态封面素材目录 */
export const saveMediaCatalog = (data: MediaCatalog) =>
  http.request<MediaCatalog>("put", "/api/site-config/media-catalog", { data });

/** 获取所有站点配置（带详情） */
export const getAllSiteConfig = () => {
  return http.request<SiteConfigItem[]>("get", "/api/site-config/list");
};

/** 获取单个配置 */
export const getSiteConfig = (key: string) => {
  return http.request<SiteConfigItem>("get", `/api/site-config/${key}`);
};

/** 更新单个配置 */
export const updateSiteConfig = (
  key: string,
  data: { value: string; description?: string }
) => {
  return http.request<SiteConfigItem>("put", `/api/site-config/${key}`, {
    data
  });
};

/** 新增配置 */
export const createSiteConfig = (data: {
  key: string;
  value: string;
  description?: string;
}) => {
  return http.request<SiteConfigItem>("post", "/api/site-config", { data });
};

/** 删除配置 */
export const deleteSiteConfig = (key: string) => {
  return http.request<{ ok: boolean }>("delete", `/api/site-config/${key}`);
};
