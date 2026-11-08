import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { WorkspaceRole } from "@/lib/domain";

export type Profile = Tables<"profiles">;
export type Workspace = Tables<"workspaces">;
export type MyWorkspace = Pick<Workspace, "id" | "name" | "slug" | "logo_url" | "created_at"> & {
  role: WorkspaceRole;
  joined_at: string;
};

/** Signed-in user's profile (RLS: own row), cached per request. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return data ?? null;
});

/** Profile or redirect to login (defence in depth — the proxy already guards these routes). */
export async function requireProfile(nextPath?: string): Promise<Profile> {
  const profile = await getMyProfile();
  if (!profile) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return profile;
}

/** Workspaces the current user belongs to, oldest membership first. */
export const getMyWorkspaces = cache(async (): Promise<MyWorkspace[]> => {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, joined_at, workspace:workspaces!inner(id, name, slug, logo_url, created_at, deleted_at)")
    .eq("user_id", uid)
    .order("joined_at", { ascending: true });

  return (data ?? [])
    .filter((row) => row.workspace && !row.workspace.deleted_at)
    .map((row) => ({
      id: row.workspace.id,
      name: row.workspace.name,
      slug: row.workspace.slug,
      logo_url: row.workspace.logo_url,
      created_at: row.workspace.created_at,
      role: row.role,
      joined_at: row.joined_at,
    }));
});

/** Workspace by slug under RLS — null when it doesn't exist OR the user isn't a member. */
export const getWorkspaceBySlug = cache(async (slug: string): Promise<Workspace | null> => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
});

/** Where a signed-in user should land (spec §B.1 business logic). */
export async function resolveAppEntry(): Promise<string> {
  const profile = await getMyProfile();
  if (!profile) return "/login";
  const workspaces = await getMyWorkspaces();
  if (!profile.onboarded_at || workspaces.length === 0) return "/onboarding";
  const last = workspaces.find((w) => w.id === profile.last_workspace_id);
  return `/w/${(last ?? workspaces[0]!).slug}`;
}
