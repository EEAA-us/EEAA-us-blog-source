import { http } from "@/utils/http";

export type PublishStatus = {
  phase: string;
  message: string;
  ready: boolean;
  published: boolean;
  missingConfig: string[];
  url?: string;
  lastSuccessfulUrl?: string;
  startedAt?: string;
  finishedAt?: string;
};

export const getPublishStatus = () => http.request<PublishStatus>("get", "/api/publish/status");
export const startPublication = () => http.request<PublishStatus>("post", "/api/publish/start");

export type OnlineStats = {
  queriedAt: string;
  range: { start: string; end: string };
  totals: { pv: number; uv: number; sessions: number };
  ranking: { id: number; title: string; views: number; likes: number }[];
};
export const getOnlineStatistics = () => http.request<OnlineStats>("get", "/api/publish/statistics");
