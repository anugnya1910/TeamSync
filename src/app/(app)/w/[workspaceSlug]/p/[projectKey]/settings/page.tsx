import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectSettings } from "@/components/project/project-settings";
import { getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/w/[workspaceSlug]/p/[projectKey]/settings">) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role, profile:profiles!inner(full_name, avatar_url, handle)")
    .eq("workspace_id", workspace.id)
    .order("joined_at");
  return <ProjectSettings workspaceMembers={(data ?? []) as never} />;
}
