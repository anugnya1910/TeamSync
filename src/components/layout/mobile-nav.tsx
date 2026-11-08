"use client";

import { Home, Inbox, ListChecks, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { activeNavKey, workspaceHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NavList } from "./nav-list";
import { useShellUi } from "./shell-ui-context";
import { UserMenu } from "./user-menu";
import { useWorkspace } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

const tabClass =
  "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium";

/** Mobile (< 768px) bottom tab bar + full-navigation drawer (spec §F.5). */
export function MobileNav({ onThemeChange }: { onThemeChange: (t: "system" | "light" | "dark") => void }) {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const { setPaletteOpen, mobileMenuOpen, setMobileMenuOpen } = useShellUi();
  const active = activeNavKey(pathname, workspace.slug);

  const tab = (key: "home" | "my-tasks" | "inbox", label: string, Icon: typeof Home, segment: string) => (
    <Link
      href={workspaceHref(workspace.slug, segment)}
      aria-current={active === key ? "page" : undefined}
      className={cn(tabClass, active === key ? "text-primary" : "text-muted-foreground")}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );

  return (
    <>
      <nav
        aria-label="Mobile"
        data-testid="mobile-bottom-nav"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      >
        <div className="flex items-stretch gap-1 px-2 py-1">
          {tab("home", "Home", Home, "")}
          {tab("my-tasks", "My Tasks", ListChecks, "my-tasks")}
          <button type="button" className={cn(tabClass, "text-muted-foreground")} onClick={() => setPaletteOpen(true)}>
            <Search className="size-5" aria-hidden />
            Search
          </button>
          {tab("inbox", "Inbox", Inbox, "inbox")}
          <button
            type="button"
            className={cn(tabClass, mobileMenuOpen ? "text-primary" : "text-muted-foreground")}
            onClick={() => setMobileMenuOpen(true)}
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="size-5" aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Menu</DrawerTitle>
            <DrawerDescription className="sr-only">Workspace navigation</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-6">
            <WorkspaceSwitcher />
            <nav aria-label="Workspace">
              <NavList onNavigate={() => setMobileMenuOpen(false)} />
            </nav>
            <div className="flex items-center gap-2 border-t pt-3">
              <div className="min-w-0 flex-1">
                <UserMenu />
              </div>
              <ThemeToggle onChange={onThemeChange} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
