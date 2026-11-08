import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ params }: PageProps<"/w/[workspaceSlug]/projects">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="projects" slug={workspaceSlug} />;
}
