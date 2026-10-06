import { request } from "./client";
import { readPublishedIndex } from "@/lib/published-content";

export interface ProjectItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  long_description: string;
  cover_image: string;
  tech_stack: string[];
  link_github: string;
  link_gitee: string;
  link_live: string;
  link_docs: string;
  status: string;
  status_label: string;
  is_featured: boolean;
  sort: number;
  created_at: string;
}

export function getProjects() {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedIndex().then((index) => index.projects as unknown as ProjectItem[]);
  return request<ProjectItem[]>("/api/projects");
}

export function getProjectBySlug(slug: string) {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") return readPublishedIndex().then((index) => {
    const project = index.projects.find((item) => item.slug === slug);
    if (!project) throw new Error("Project not found");
    return project as unknown as ProjectItem;
  });
  return request<ProjectItem>(`/api/projects/${slug}`);
}
