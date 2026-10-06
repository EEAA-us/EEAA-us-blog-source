"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getCloudStatsIdentity } from "@/lib/cloud-stats-client";

export default function VisitorTracker() {
  const pathname = usePathname();
  const lastVisit = useRef<{ pathname: string; eventId: string } | null>(null);
  useEffect(() => {
    const { browserId, sessionId } = getCloudStatsIdentity();
    const visit = lastVisit.current?.pathname === pathname
      ? lastVisit.current
      : { pathname, eventId: crypto.randomUUID() };
    lastVisit.current = visit;
    fetch("/api/visitors/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: visit.eventId, path: pathname, browserId, sessionId }),
    }).catch(() => {});

    // 获取地理位置，供看板娘欢迎语使用
    if (!sessionStorage.getItem("visitor_location")) {
      fetch("/api/visitors/location")
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0 && res.data && (res.data.city || res.data.region)) {
            sessionStorage.setItem("visitor_location", JSON.stringify(res.data));
          }
        })
        .catch(() => {});
    }
  }, [pathname]);

  return null;
}
