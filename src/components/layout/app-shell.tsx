"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { saveThemePreference } from "@/app/(app)/actions";
import { SyncLine, SyncLineProvider } from "@/components/brand/sync-line";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { ProfileReducedMotionContext } from "@/lib/motion";
import { workspaceHref } from "@/lib/navigation";
import { CommandPalette, type PaletteSource } from "./command-palette";
import { ComingSoonDialog } from "./coming-soon-dialog";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { MobileNav } from "./mobile-nav";
import { ShellUiProvider, useShellUi } from "./shell-ui-context";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { WorkspaceProvider, useWorkspace, type WorkspaceContextValue } from "./workspace-context";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** G then B / L / A: board, list, analytics of the project currently open (spec §F.7). */
function boardShortcuts(router: ReturnType<typeof useRouter>) {
  const projectBase = () => window.location.pathname.match(/^\/w\/[^/]+\/p\/[A-Z]{2,5}/)?.[0];
  const to = (seg: string) => () => {
    const base = projectBase();
    if (base) router.push(`${base}/${seg}`);
  };
  return [
    { combo: "g b", handler: to("board") },
    { combo: "g l", handler: to("list") },
    { combo: "g a", handler: to("analytics") },
  ];
}

function GlobalDialogs() {
  const { newProjectOpen, setNewProjectOpen, newTaskOpen, setNewTaskOpen } = useShellUi();
  const { workspace } = useWorkspace();
  const { data: teams = [] } = useQuery({
    queryKey: ["teams", workspace.id],
    enabled: newProjectOpen,
    queryFn: async () => {
      const { data } = await createClient().from("teams").select("id, name").eq("workspace_id", workspace.id).order("name");
      return data ?? [];
    },
  });
  return (
    <>
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} teams={teams} />
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </>
  );
}

/** Applies the profile's theme once per session and reflects reduced motion on <html>. */
function ProfilePreferencesSync({ theme, reducedMotion }: { theme: string; reducedMotion: boolean }) {
  const { theme: current, setTheme } = useTheme();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    try {
      if (window.sessionStorage.getItem("teamsync:theme-synced") === "1") return;
      window.sessionStorage.setItem("teamsync:theme-synced", "1");
    } catch {
      // ignore storage errors
    }
    if (theme && theme !== current) setTheme(theme);
  }, [theme, current, setTheme]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.reducedMotion;
    };
  }, [reducedMotion]);
  return null;
}

function ShellHotkeys() {
  const router = useRouter();
  const { setPaletteOpen, setShortcutsOpen, paletteOpen, setNewTaskOpen, setNewProjectOpen } = useShellUi();
  const { role } = useWorkspace();
  // Re-read the slug lazily from the URL to avoid stale closures across workspace switches.
  const slug = () => window.location.pathname.split("/")[2] ?? "";
  useHotkeys([
    { combo: "mod+k", handler: () => setPaletteOpen(!paletteOpen), allowInInputs: true },
    { combo: "/", handler: () => setPaletteOpen(true) },
    { combo: "?", handler: () => setShortcutsOpen(true) },
    { combo: "g h", handler: () => router.push(workspaceHref(slug())) },
    { combo: "g m", handler: () => router.push(workspaceHref(slug(), "members")) },
    { combo: "g p", handler: () => router.push(workspaceHref(slug(), "projects")) },
    { combo: "g i", handler: () => router.push(workspaceHref(slug(), "inbox")) },
    { combo: "g t", handler: () => router.push(workspaceHref(slug(), "my-tasks")) },
    { combo: "c", handler: () => setNewTaskOpen(true) },
    { combo: "n p", handler: () => role !== "guest" && setNewProjectOpen(true) },
    ...boardShortcuts(router),
  ]);
  return null;
}

export function AppShell({
  value,
  children,
  paletteSources,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
  paletteSources?: PaletteSource[];
}) {
  const onThemeChange = useCallback((t: "system" | "light" | "dark") => {
    void saveThemePreference(t).then((r) => {
      if (!r.ok) toast.error("Couldn't save your theme preference.");
    });
  }, []);

  return (
    <WorkspaceProvider value={value}>
      <ProfileReducedMotionContext value={value.user.reducedMotion}>
        <SyncLineProvider>
          <ShellUiProvider>
            <ProfilePreferencesSync theme={value.user.theme} reducedMotion={value.user.reducedMotion} />
            <ShellHotkeys />
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              Skip to content
            </a>
            <SyncLine className="fixed inset-x-0 top-0 z-50" />
            <div className="flex min-h-dvh w-full pt-0.5">
              <Sidebar onThemeChange={onThemeChange} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-10">
                  <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">{children}</div>
                </main>
              </div>
            </div>
            <MobileNav onThemeChange={onThemeChange} />
            <CommandPalette onThemeChange={onThemeChange} extraSources={paletteSources} />
            <ShortcutsDialog />
            <CreateWorkspaceDialog />
            <ComingSoonDialog />
            <GlobalDialogs />
          </ShellUiProvider>
        </SyncLineProvider>
      </ProfileReducedMotionContext>
    </WorkspaceProvider>
  );
}
