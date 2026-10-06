"use client";

import { useEffect, useState } from "react";
import { getSiteConfig } from "@/app/api/site-config";

type ProjectCoverConfig = { covers?: Record<string, string> };
type State = { covers: Record<string, string>; loading: boolean; error: string | null };

export function useProjectCovers(): State {
  const [state, setState] = useState<State>({ covers: {}, loading: true, error: null });
  useEffect(() => {
    let active = true;
    getSiteConfig()
      .then((config) => {
        const raw = config.projectCovers as ProjectCoverConfig | undefined;
        const covers = raw && typeof raw === "object" && raw.covers && typeof raw.covers === "object" ? raw.covers : {};
        if (active) setState({ covers, loading: false, error: null });
      })
      .catch(() => {
        if (active) setState({ covers: {}, loading: false, error: "项目封面配置加载失败，当前显示项目默认封面。" });
      });
    return () => { active = false; };
  }, []);
  return state;
}

export function projectCoverUrl(projectId: string, defaultUrl: string, covers: Record<string, string>): string {
  return covers[projectId] || defaultUrl;
}
