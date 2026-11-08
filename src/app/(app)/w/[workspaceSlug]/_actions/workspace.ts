"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { pgFail, withSession } from "@/lib/actions/shared";
import { clientEnv } from "@/lib/env";
import { getAppOrigin } from "@/lib/request-origin";
import {
  changeRoleSchema,
  createInviteSchema,
  deleteWorkspaceSchema,
  memberRefSchema,
  teamSchema,
  updateWorkspaceSchema,
  uuidSchema,
} from "@/lib/validation/phase2";

export async function createInvite(input: z.input<typeof createInviteSchema>): Promise<ActionResult<{ url: string }>> {
  return withSession(createInviteSchema, input, async ({ data, supabase }) => {
    const { data: rows, error } = await supabase.rpc("create_invitation", {
      p_workspace: data.workspaceId,
      p_role: data.role,
      p_email: data.email ?? undefined,
      p_max_uses: data.maxUses,
      p_expires_days: data.expiresInDays,
    });
    if (error || !rows?.[0]) return pgFail(error);
    const origin = (await getAppOrigin()) || clientEnv.NEXT_PUBLIC_APP_URL;
    revalidatePath("/w/[workspaceSlug]/members", "page");
    return ok({ url: `${origin}/invite/${rows[0].token}` });
  });
}

export async function revokeInvite(invitationId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, invitationId, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("revoke_invitation", { p_id: data });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/members", "page");
    return ok(null);
  });
}

export async function acceptInvite(token: string): Promise<ActionResult<{ slug: string }>> {
  return withSession(z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, "Invalid invite"), token, async ({ data, supabase }) => {
    const { data: ws, error } = await supabase.rpc("accept_invitation", { p_token: data });
    if (error || !ws) return pgFail(error);
    revalidatePath("/", "layout");
    return ok({ slug: ws.slug });
  });
}

export async function changeMemberRole(input: z.input<typeof changeRoleSchema>): Promise<ActionResult<null>> {
  return withSession(changeRoleSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("change_member_role", {
      p_workspace: data.workspaceId,
      p_user: data.userId,
      p_role: data.role,
    });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok(null);
  });
}

export async function removeMember(input: z.input<typeof memberRefSchema>): Promise<ActionResult<null>> {
  return withSession(memberRefSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("remove_member", { p_workspace: data.workspaceId, p_user: data.userId });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok(null);
  });
}

export async function leaveWorkspace(workspaceId: string): Promise<ActionResult<never>> {
  const res = await withSession(uuidSchema, workspaceId, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("leave_workspace", { p_workspace: data });
    if (error) return pgFail(error);
    return ok(null);
  });
  if (!res.ok) return res;
  revalidatePath("/", "layout");
  redirect("/app");
}

export async function transferOwnership(input: z.input<typeof memberRefSchema>): Promise<ActionResult<null>> {
  return withSession(memberRefSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("transfer_ownership", { p_workspace: data.workspaceId, p_new_owner: data.userId });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok(null);
  });
}

export async function deleteWorkspace(input: z.input<typeof deleteWorkspaceSchema>): Promise<ActionResult<never>> {
  const res = await withSession(deleteWorkspaceSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("delete_workspace", { p_workspace: data.workspaceId, p_confirm_slug: data.confirmSlug });
    if (error) return pgFail(error);
    return ok(null);
  });
  if (!res.ok) return res;
  revalidatePath("/", "layout");
  redirect("/app");
}

export async function updateWorkspace(input: z.input<typeof updateWorkspaceSchema>): Promise<ActionResult<{ slug: string }>> {
  return withSession(updateWorkspaceSchema, input, async ({ data, supabase }) => {
    const { data: ws, error } = await supabase
      .from("workspaces")
      .update({ name: data.name, slug: data.slug })
      .eq("id", data.workspaceId)
      .select("slug")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return fail("CONFLICT", "That workspace URL is already taken.", { slug: ["That workspace URL is already taken."] });
      return pgFail(error);
    }
    if (!ws) return fail("FORBIDDEN", "Only owners and admins can change workspace settings.");
    revalidatePath("/", "layout");
    return ok({ slug: ws.slug });
  });
}

// ------------------------------------------------------------------ Teams

export async function createTeam(input: z.input<typeof teamSchema>): Promise<ActionResult<{ id: string }>> {
  return withSession(teamSchema, input, async ({ data, supabase, userId }) => {
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ workspace_id: data.workspaceId, name: data.name, color: data.color, icon: data.icon, created_by: userId })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return fail("CONFLICT", "A team with that name already exists.", { name: ["Name already used"] });
      return pgFail(error);
    }
    revalidatePath("/w/[workspaceSlug]/teams", "page");
    return ok({ id: team.id });
  });
}

const updateTeamSchema = teamSchema.omit({ workspaceId: true }).extend({ teamId: uuidSchema });
export async function updateTeam(input: z.input<typeof updateTeamSchema>): Promise<ActionResult<null>> {
  return withSession(updateTeamSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.from("teams").update({ name: data.name, color: data.color, icon: data.icon }).eq("id", data.teamId);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/teams", "layout");
    return ok(null);
  });
}

export async function deleteTeam(teamId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, teamId, async ({ data, supabase }) => {
    const { error } = await supabase.from("teams").delete().eq("id", data);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/teams", "layout");
    return ok(null);
  });
}

const setTeamMembersSchema = z.object({ teamId: uuidSchema, userIds: z.array(uuidSchema).max(200) });
export async function setTeamMembers(input: z.input<typeof setTeamMembersSchema>): Promise<ActionResult<null>> {
  return withSession(setTeamMembersSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("set_team_members", { p_team: data.teamId, p_users: data.userIds });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/teams", "layout");
    return ok(null);
  });
}
