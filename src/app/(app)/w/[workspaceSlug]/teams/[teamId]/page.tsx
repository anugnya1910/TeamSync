import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TeamDetail } from "@/components/workspace/teams-view";
import { getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/w/[workspaceSlug]/teams/[teamId]">) {
  const { workspaceSlug, teamId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) notFound();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, color, icon, team_members(user_id, profile:profiles(full_name, avatar_url))")
    .eq("id", teamId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!team) notFound();
  const [{ data: members }, { data: projects }] = await Promise.all([
    supabase.from("workspace_members").select("user_id, profile:profiles!inner(full_name, avatar_url)").eq("workspace_id", workspace.id),
    supabase.from("projects").select("id, key, name, color, icon").eq("team_id", team.id).order("name"),
  ]);
  const teamMembers = (team.team_members ?? []).filter((m) => m.profile).map((m) => ({ user_id: m.user_id, full_name: m.profile!.full_name, avatar_url: m.profile!.avatar_url }));
  return (
    <>
      <Link href={`/w/${workspaceSlug}/teams`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Teams
      </Link>
      <PageHeader title={team.name} description={`${teamMembers.length} members`} />
      <TeamDetail
        team={{ id: team.id, name: team.name, color: team.color, icon: team.icon, members: teamMembers, projectCount: projects?.length ?? 0 }}
        workspaceMembers={(members ?? []).map((m) => ({ user_id: m.user_id, full_name: m.profile.full_name, avatar_url: m.profile.avatar_url }))}
        projects={projects ?? []}
      />
    </>
  );
}
