"use client";

import { Bell, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { activeNavKey, PRIMARY_NAV, SETTINGS_NAV, workspaceHref } from "@/lib/navigation";
import { useShellUi } from "./shell-ui-context";
import { useWorkspace } from "./workspace-context";
import { WorkspaceBadge } from "./workspace-switcher";

const noopSubscribe = () => () => {};
/** Hydration-safe platform check (server snapshot = not Mac). */
export function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const { setPaletteOpen, showComingSoon } = useShellUi();
  const key = activeNavKey(pathname, workspace.slug);
  const current = [...PRIMARY_NAV, SETTINGS_NAV].find((n) => n.key === key);
  const isMac = useIsMac();

  const crumbs = [
    { href: workspaceHref(workspace.slug), label: workspace.name },
    ...(current && current.key !== "home"
      ? [{ href: workspaceHref(workspace.slug, current.segment), label: current.label }]
      : [{ href: workspaceHref(workspace.slug), label: "Home" }]),
  ];

  return (
    <header className="sticky top-0.5 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <WorkspaceBadge name={workspace.name} className="md:hidden" />
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            {crumbs.map((c, i) => (
              <Fragment key={`${c.href}-${i}`}>
                {i > 0 ? (
                  <li aria-hidden className="text-muted-foreground">
                    /
                  </li>
                ) : null}
                <li className={i === 0 ? "hidden min-w-0 truncate sm:block" : "min-w-0 truncate"}>
                  {i === crumbs.length - 1 ? (
                    <span aria-current="page" className="font-semibold">
                      {c.label}
                    </span>
                  ) : (
                    <Link href={c.href} className="text-muted-foreground hover:text-foreground">
                      {c.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      </div>

      <Button
        variant="outline"
        className="hidden h-8 w-56 justify-between px-2.5 text-muted-foreground md:inline-flex"
        onClick={() => setPaletteOpen(true)}
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" aria-hidden /> Search…
        </span>
        <kbd className="rounded border bg-surface-2 px-1.5 font-tabular text-[11px]">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Notifications (0 unread)">
            <Bell className="size-4" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re all caught up. Assignment, mention and due-date notifications arrive with
            Projects in Phase 2.
          </p>
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        className="hidden sm:inline-flex"
        onClick={() =>
          showComingSoon({
            phase: 2,
            title: "Quick create arrives in Phase 2",
            description:
              "Create tasks and projects from anywhere with the New button or the C shortcut once Projects ship.",
          })
        }
      >
        <Plus className="size-4" aria-hidden /> New
      </Button>
    </header>
  );
}
