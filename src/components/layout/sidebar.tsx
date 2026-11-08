"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { GamificationChip } from "@/components/gamification/gamification-chip";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavList } from "./nav-list";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

const STORAGE_KEY = "teamsync:sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    // storage unavailable (private mode) — keep in-memory state only
  }
}

export function Sidebar({ onThemeChange }: { onThemeChange: (t: "system" | "light" | "dark") => void }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted UI preference after mount
    setCollapsed(readCollapsed());
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(!c);
      return !c;
    });
  };

  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed || undefined}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-surface-2 transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-[264px]",
      )}
    >
      <div className={cn("flex items-center gap-1 p-3", collapsed && "flex-col")}>
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
      </div>
      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-1">
        <NavList collapsed={collapsed} />
      </nav>
      <div className={cn("space-y-1 border-t p-3", collapsed && "flex flex-col items-center")}>
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <ThemeToggle onChange={onThemeChange} align="start" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </Button>
        </div>
        <GamificationChip collapsed={collapsed} />
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
