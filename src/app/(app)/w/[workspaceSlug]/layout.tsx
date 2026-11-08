import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getMyWorkspaces, getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/w/[workspaceSlug]">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile(`/w/${workspaceSlug}`);
  const [workspace, workspaces] = await Promise.all([
    getWorkspaceBySlug(workspaceSlug),
    getMyWorkspaces(),
  ]);
  // RLS returns no row for workspaces the user isn't in → 404 (never 403, spec §H.2).
  if (!workspace) notFound();
  const membership = workspaces.find((w) => w.id === workspace.id);
  if (!membership) notFound();

  if (profile.last_workspace_id !== workspace.id) {
    const supabase = await createClient();
    await supabase.rpc("set_last_workspace", { p_workspace: workspace.id });
  }

  const theme = (["system", "light", "dark"] as const).includes(profile.theme as "system")
    ? (profile.theme as "system" | "light" | "dark")
    : "system";

  return (
    <AppShell
      value={{
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          logoUrl: workspace.logo_url,
        },
        role: membership.role,
        workspaces: workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          logoUrl: w.logo_url,
          role: w.role,
        })),
        user: {
          id: profile.id,
          fullName: profile.full_name,
          handle: profile.handle,
          avatarUrl: profile.avatar_url,
          theme,
          reducedMotion: profile.reduced_motion,
          timezone: profile.timezone,
        },
      }}
    >
      {children}
    </AppShell>
  );
}
