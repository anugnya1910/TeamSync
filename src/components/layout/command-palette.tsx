"use client";

import { Building2, LogOut, Monitor, Moon, Plus, Settings, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { ACCOUNT_SETTINGS, PRIMARY_NAV, SETTINGS_NAV, workspaceHref } from "@/lib/navigation";
import { useShellUi } from "./shell-ui-context";
import { useWorkspace } from "./workspace-context";

export type PaletteItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  onSelect: () => void;
};

export type PaletteGroup = { id: string; heading: string; items: PaletteItem[]; loading?: boolean };

/**
 * A source contributes one group for the current query. Phase 1 sources are static; Phase 2 adds
 * async sources (tasks, projects, members via `search_workspace`) by returning `loading` + items.
 */
export type PaletteSource = (ctx: { query: string; close: () => void }) => PaletteGroup | null;

export function CommandPalette({
  onThemeChange,
  extraSources = [],
}: {
  onThemeChange: (t: "system" | "light" | "dark") => void;
  extraSources?: PaletteSource[];
}) {
  const { paletteOpen, setPaletteOpen, setCreateWorkspaceOpen } = useShellUi();
  const { workspace, workspaces } = useWorkspace();
  const { setTheme } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [, start] = useTransition();

  const close = () => {
    setPaletteOpen(false);
    setQuery("");
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const staticGroups = useMemo<PaletteGroup[]>(() => {
    const nav: PaletteGroup = {
      id: "navigation",
      heading: "Navigation",
      items: [...PRIMARY_NAV, SETTINGS_NAV].map((n) => ({
        id: `nav-${n.key}`,
        label: `Go to ${n.label}`,
        icon: n.icon,
        keywords: [n.label],
        onSelect: () => go(workspaceHref(workspace.slug, n.segment)),
      })),
    };
    const switcher: PaletteGroup = {
      id: "workspaces",
      heading: "Workspaces",
      items: [
        ...workspaces
          .filter((w) => w.id !== workspace.id)
          .map((w) => ({
            id: `ws-${w.id}`,
            label: `Switch to ${w.name}`,
            icon: Building2,
            keywords: [w.slug],
            onSelect: () => go(`/w/${w.slug}`),
          })),
        {
          id: "ws-create",
          label: "Create workspace",
          icon: Plus,
          onSelect: () => {
            close();
            setCreateWorkspaceOpen(true);
          },
        },
      ],
    };
    const prefs: PaletteGroup = {
      id: "preferences",
      heading: "Preferences",
      items: (
        [
          ["light", "Use light theme", Sun],
          ["dark", "Use dark theme", Moon],
          ["system", "Use system theme", Monitor],
        ] as const
      ).map(([value, label, icon]) => ({
        id: `theme-${value}`,
        label,
        icon,
        keywords: ["theme", "appearance", "toggle"],
        onSelect: () => {
          setTheme(value);
          onThemeChange(value);
          close();
        },
      })),
    };
    const account: PaletteGroup = {
      id: "account",
      heading: "Account",
      items: [
        ...ACCOUNT_SETTINGS.map((s) => ({
          id: `settings-${s.href}`,
          label: `Open ${s.label.toLowerCase()} settings`,
          icon: Settings,
          keywords: ["settings", s.label],
          onSelect: () => go(s.href),
        })),
        {
          id: "sign-out",
          label: "Sign out",
          icon: LogOut,
          onSelect: () => {
            close();
            start(() => signOut());
          },
        },
      ],
    };
    return [nav, switcher, prefs, account];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, workspace.slug, workspaces]);

  const dynamicGroups = extraSources
    .map((source) => source({ query, close }))
    .filter((g): g is PaletteGroup => Boolean(g));
  const groups = [...dynamicGroups, ...staticGroups];

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={(o) => (o ? setPaletteOpen(true) : close())}
      title="Command palette"
      description="Search for a page or command"
    >
      <Command loop>
      <CommandInput placeholder="Type a command or search…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((g, gi) => (
          <div key={g.id}>
            {gi > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={g.heading}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                  onSelect={item.onSelect}
                >
                  {item.icon ? <item.icon className="size-4" aria-hidden /> : null}
                  {item.label}
                  {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
