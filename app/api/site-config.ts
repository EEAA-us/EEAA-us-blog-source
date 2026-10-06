import { request } from "./client";
import { readPublishedSelection } from "@/lib/published-content";

export interface SiteConfigItem {
  id: number;
  key: string;
  value: string;
  description: string;
}

let pendingConfig: Promise<Record<string, unknown>> | undefined;
export function getSiteConfig(signal?: AbortSignal) {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedSelection(index => index.siteConfig);
  if (signal) return request<Record<string, unknown>>("/api/site-config", { signal });
  if (!pendingConfig) pendingConfig = request<Record<string, unknown>>("/api/site-config").finally(() => { pendingConfig = undefined; });
  return pendingConfig;
}

export function getSiteConfigByKey(key: string) {
  return request<SiteConfigItem>(`/api/site-config/${key}`);
}
