import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";
import { getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function WorkspaceSettingsPage({ params }: PageProps<"/w/[workspaceSlug]/settings">) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role, profile:profiles!inner(full_name)")
    .eq("workspace_id", workspace.id);
  const members = (data ?? []).map((m) => ({ user_id: m.user_id, role: m.role, full_name: m.profile.full_name }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Workspace settings" description="General details, optional AI assistance and gamification for everyone in this workspace." />
      <WorkspaceSettings members={members} features={{ aiEnabled: workspace.ai_enabled, gamificationEnabled: workspace.gamification_enabled, aiDailyLimit: workspace.ai_daily_limit }} />
    </div>
  );
}
