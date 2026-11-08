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
import { WorkspaceProvider, type WorkspaceContextValue } from "./workspace-context";

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
  const { setPaletteOpen, setShortcutsOpen, paletteOpen } = useShellUi();
  // Re-read the slug lazily from the URL to avoid stale closures across workspace switches.
  const slug = () => window.location.pathname.split("/")[2] ?? "";
  useHotkeys([
    { combo: "mod+k", handler: () => setPaletteOpen(!paletteOpen), allowInInputs: true },
    { combo: "/", handler: () => setPaletteOpen(true) },
    { combo: "?", handler: () => setShortcutsOpen(true) },
    { combo: "g h", handler: () => router.push(workspaceHref(slug())) },
    { combo: "g m", handler: () => router.push(workspaceHref(slug(), "members")) },
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
          </ShellUiProvider>
        </SyncLineProvider>
      </ProfileReducedMotionContext>
    </WorkspaceProvider>
  );
}
