"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeNavKey, PRIMARY_NAV, SETTINGS_NAV, workspaceHref, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useShellUi } from "./shell-ui-context";
import { useWorkspace } from "./workspace-context";

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { workspace } = useWorkspace();
  const link = (
    <Link
      href={workspaceHref(workspace.slug, item.segment)}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-[var(--shadow-e1)] ring-1 ring-border"
          : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const { showComingSoon } = useShellUi();
  const active = activeNavKey(pathname, workspace.slug);

  return (
    <ul className="space-y-0.5">
      {PRIMARY_NAV.map((item) => (
        <li key={item.key} className={cn(item.key === "projects" && "pt-3")}>
          {item.key === "projects" && !collapsed ? (
            <div className="mb-1 flex items-center justify-between px-2.5">
              <span className="text-meta tracking-wide text-muted-foreground uppercase">Projects</span>
              <button
                type="button"
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="New project"
                onClick={() =>
                  showComingSoon({
                    phase: 2,
                    title: "Projects arrive in Phase 2",
                    description:
                      "Create projects with a key (like TS), milestones and tasks — or start from the College Project and Event Planning templates.",
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          <NavLink item={item} active={active === item.key} collapsed={collapsed} onNavigate={onNavigate} />
        </li>
      ))}
      <li className="pt-3">
        <NavLink item={SETTINGS_NAV} active={active === "settings"} collapsed={collapsed} onNavigate={onNavigate} />
      </li>
    </ul>
  );
}
