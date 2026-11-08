import { notFound } from "next/navigation";
import { ProjectShell } from "@/components/project/project-shell";
import { getProjectBundle } from "@/lib/data/project";
import { getWorkspaceBySlug } from "@/lib/data/session";

export default async function ProjectLayout({ children, params }: LayoutProps<"/w/[workspaceSlug]/p/[projectKey]">) {
  const { workspaceSlug, projectKey } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const bundle = await getProjectBundle(workspace.id, projectKey);
  // Private or foreign project → 404 (never reveal existence).
  if (!bundle) notFound();
  return <ProjectShell bundle={bundle}>{children}</ProjectShell>;
}
