import { http } from "@/utils/http";
import { getFriendLinks as getAdminFriendLinks } from "./friend-link";
import type { FriendLinkItem as CanonicalFriendLinkItem } from "./friend-link";

/** Preserve the older type shape for callers of this compatibility module. */
export type FriendLinkItem = Omit<CanonicalFriendLinkItem, "updated_at">;
export { deleteFriendLink, updateFriendLink } from "./friend-link";

/** Legacy public-list name: returns only approved links. */
export const getFriendLinks = () => {
  return http.request<FriendLinkItem[]>("get", "/api/friend-links");
};

/** Legacy admin-list name: includes unapproved links. */
export { getAdminFriendLinks };

/** Preserve the legacy optional approval field accepted by admin callers. */
export const createFriendLink = (data: {
  name: string;
  url: string;
  avatar?: string;
  description?: string;
  sort?: number;
  is_approved?: boolean;
}) => {
  return http.request<FriendLinkItem>("post", "/api/friend-links", { data });
};
