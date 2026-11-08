"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
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
  const { workspace, role } = useWorkspace();
  const { setPaletteOpen, setNewTaskOpen, setNewProjectOpen } = useShellUi();
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

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="hidden sm:inline-flex">
            <Plus className="size-4" aria-hidden /> New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setNewTaskOpen(true)}>
            New task <DropdownMenuShortcut>C</DropdownMenuShortcut>
          </DropdownMenuItem>
          {role !== "guest" ? (
            <DropdownMenuItem onSelect={() => setNewProjectOpen(true)}>
              New project <DropdownMenuShortcut>N P</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
