export interface ProjectOutlineItem {
  id: string;
  title: string;
  description: string;
  parentId?: string;
  slug?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  coverImage: string;
  techStack: string[];
  links: { github?: string; gitee?: string; live?: string; docs?: string };
  featured?: boolean;
  status: "active" | "archived" | "developing";
  statusLabel: string;
  updatedAt: string;
  outline?: ProjectOutlineItem[];
  categorySlug?: string;
}

export const projects: Project[] = [];

