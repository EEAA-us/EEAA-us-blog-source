import ProjectDetailClient from "./ProjectDetailClient";
import { projects } from "../projectsData";

export async function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE !== "published") return [];
  return projects.map((project) => ({ id: project.id }));
}

export default function ProjectPage() {
  return <ProjectDetailClient />;
}
