import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TeamsView, type TeamCard } from "@/components/workspace/teams-view";
import { getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ params }: PageProps<"/w/[workspaceSlug]/teams">) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const supabase = await createClient();
  const [{ data: teams }, { data: projects }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, color, icon, team_members(user_id, profile:profiles(full_name, avatar_url))")
      .eq("workspace_id", workspace.id)
      .order("name"),
    supabase.from("projects").select("team_id").eq("workspace_id", workspace.id).not("team_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  for (const p of projects ?? []) if (p.team_id) counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1);
  const cards: TeamCard[] = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    icon: t.icon,
    projectCount: counts.get(t.id) ?? 0,
    members: (t.team_members ?? [])
      .filter((m) => m.profile)
      .map((m) => ({ user_id: m.user_id, full_name: m.profile!.full_name, avatar_url: m.profile!.avatar_url })),
  }));
  return (
    <>
      <PageHeader title="Teams" description="Group members to add them to projects together." />
      <TeamsView teams={cards} />
    </>
  );
}
