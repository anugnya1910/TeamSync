import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsList } from "@/components/project/projects-list";
import { listProjects } from "@/lib/data/project";
import { getWorkspaceBySlug } from "@/lib/data/session";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ params, searchParams }: PageProps<"/w/[workspaceSlug]/projects">) {
  const { workspaceSlug } = await params;
  const sp = await searchParams;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const projects = await listProjects(workspace.id, { includeArchived: sp.archived === "1" });
  return (
    <>
      <PageHeader title="Projects" description="Progress is done effort ÷ total effort of each project's tasks." />
      <ProjectsList projects={projects} />
    </>
  );
}
