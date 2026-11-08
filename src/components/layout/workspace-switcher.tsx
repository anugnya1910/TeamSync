"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useShellUi } from "./shell-ui-context";
import { useWorkspace } from "./workspace-context";

export function WorkspaceBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground",
        className,
      )}
    >
      {name.trim()[0]?.toUpperCase() ?? "W"}
    </span>
  );
}

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { workspace, workspaces, role } = useWorkspace();
  const { setCreateWorkspaceOpen } = useShellUi();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-auto w-full justify-start gap-2.5 px-2 py-1.5", collapsed && "justify-center px-0")}
          aria-label={`Switch workspace (current: ${workspace.name})`}
        >
          <WorkspaceBadge name={workspace.name} />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{workspace.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} asChild>
            <Link href={`/w/${w.slug}`} aria-current={w.id === workspace.id ? "true" : undefined}>
              <WorkspaceBadge name={w.name} className="size-6 text-xs" />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id ? <Check className="size-4" aria-hidden /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setCreateWorkspaceOpen(true)}>
          <Plus className="size-4" aria-hidden /> Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
