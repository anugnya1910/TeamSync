import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/domain";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { initials, pluralize, shortDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Members" };

/** Read-only member directory (management — roles, invites — arrives in Phase 2). */
export default async function MembersPage({ params }: PageProps<"/w/[workspaceSlug]/members">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("workspace_members")
    .select("role, joined_at, profile:profiles!inner(id, full_name, handle, avatar_url, job_title)")
    .eq("workspace_id", workspace.id)
    .order("joined_at", { ascending: true });
  const members = rows ?? [];

  return (
    <>
      <PageHeader title="Members" description={pluralize(members.length, "member") + " in " + workspace.name} />
      <div className="mb-4 flex items-start gap-3 rounded-xl border bg-surface-2 p-4 text-sm">
        <UserPlus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          Invite links, role changes and member removal arrive in Phase 2. This list is live data
          from your workspace.
        </p>
      </div>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {members.map((m) => (
          <li key={m.profile.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar className="size-9 border">
              {m.profile.avatar_url ? <AvatarImage src={m.profile.avatar_url} alt="" /> : null}
              <AvatarFallback>{initials(m.profile.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.profile.full_name}
                {m.profile.id === profile.id ? <span className="text-muted-foreground"> (you)</span> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{m.profile.handle}
                {m.profile.job_title ? ` · ${m.profile.job_title}` : ""}
              </p>
            </div>
            <Badge variant={m.role === "owner" ? "default" : "outline"}>{ROLE_LABELS[m.role]}</Badge>
            <span className="w-full text-xs text-muted-foreground sm:w-auto">
              Joined {shortDate(m.joined_at, profile.timezone)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
