import { http } from "@/utils/http";

export type VisitorItem = {
  id: number;
  ip: string;
  path: string;
  city: string;
  region: string;
  country: string;
  district: string;
  org: string;
  org_cn: string;
  asn: string;
  is_mobile: boolean;
  is_proxy: boolean;
  is_hosting: boolean;
  browser: string;
  os: string;
  device_type: string;
  created_at: string;
};

export type VisitorResponse = {
  code: number;
  data: VisitorItem[];
};

export type VisitorCountResponse = {
  code: number;
  count: number;
};

export type VisitorIpGroup = {
  ip: string;
  visit_count: number;
  latest_at: string;
};

export type VisitorIpGroupResponse = {
  code: number;
  total: number;
  items: VisitorIpGroup[];
};

export type VisitorPathItem = {
  path: string;
  created_at: string;
};

export type VisitorPathResponse = {
  code: number;
  total: number;
  items: VisitorPathItem[];
};

/** 按 IP 聚合读取访客记录（有限窗口） */
export const getVisitorIpGroups = (params: {
  search?: string;
  offset?: number;
  limit?: number;
}) =>
  http.request<VisitorIpGroupResponse>("get", "/api/visitors/groups", {
    params
  });

/** 读取指定 IP 最近访问路径（有限窗口） */
export const getVisitorIpPaths = (params: {
  ip: string;
  offset?: number;
  limit?: number;
}) =>
  http.request<VisitorPathResponse>("get", "/api/visitors/group-visits", {
    params
  });

/** 获取最近访客列表 */
export const getVisitors = (params?: { page?: number; size?: number }) => {
  return http.request<VisitorResponse>("get", "/api/visitors", { params });
};

/** 获取总访客数 */
export const getVisitorCount = () => {
  return http.request<VisitorCountResponse>("get", "/api/visitors/count");
};

/** 删除单条访客记录 */
export const deleteVisitor = (visitorId: number) => {
  return http.request<{ code: number }>("delete", `/api/visitors/${visitorId}`);
};

/** 清空所有访客记录 */
export const clearVisitors = () => {
  return http.request<{ code: number }>("delete", "/api/visitors");
};
