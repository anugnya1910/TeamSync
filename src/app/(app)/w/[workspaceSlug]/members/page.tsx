import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MembersManager, type InviteRow, type MemberRow } from "@/components/workspace/members-manager";
import { getMyWorkspaces, getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { pluralize } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/w/[workspaceSlug]/members">) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const me = (await getMyWorkspaces()).find((w) => w.id === workspace.id);
  const isAdmin = me?.role === "owner" || me?.role === "admin";
  const supabase = await createClient();
  const [{ data: rows }, invitesRes] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("user_id, role, joined_at, profile:profiles!inner(id, full_name, handle, avatar_url, job_title)")
      .eq("workspace_id", workspace.id)
      .order("joined_at", { ascending: true }),
    isAdmin
      ? supabase
          .from("workspace_invitations")
          .select("id, role, email, max_uses, use_count, expires_at, status, created_at")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);
  const members = (rows ?? []) as MemberRow[];
  return (
    <>
      <PageHeader title="Members" description={`${pluralize(members.length, "member")} in ${workspace.name}`} />
      <MembersManager members={members} invites={(invitesRes.data ?? null) as InviteRow[] | null} />
    </>
  );
}
