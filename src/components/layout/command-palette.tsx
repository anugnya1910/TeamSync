"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckSquare,
  Clock,
  FolderKanban,
  FolderPlus,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  SquarePlus,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ACCOUNT_SETTINGS, PRIMARY_NAV, SETTINGS_NAV, workspaceHref } from "@/lib/navigation";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { parseTaskKey } from "@/lib/utils/task-key";
import { useShellUi } from "./shell-ui-context";
import { useWorkspace } from "./workspace-context";

export type PaletteItem = {
  id: string;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  onSelect: () => void;
};

export type PaletteGroup = { id: string; heading: string; items: PaletteItem[]; loading?: boolean };
/** Kept for API compatibility: extra static groups contributed by a page. */
export type PaletteSource = (ctx: { query: string; close: () => void }) => PaletteGroup | null;

const RECENT_KEY = "teamsync:recent-searches";
function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, 5);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — ignore
  }
}

type SearchRow = { kind: string; id: string; title: string; subtitle: string; url: string; rank: number };

/** Debounced (200 ms), abortable `search_workspace` RPC — RLS applies (SECURITY INVOKER). */
function useWorkspaceSearch(workspaceId: string, query: string) {
  const q = useDebouncedValue(query.trim(), 200);
  return useQuery({
    queryKey: qk.search(workspaceId, q),
    enabled: q.length >= 2,
    staleTime: 10_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await createClient()
        .rpc("search_workspace", { p_workspace: workspaceId, p_query: q, p_limit: 12 })
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []) as SearchRow[];
    },
  });
}

export function CommandPalette({
  onThemeChange,
  extraSources = [],
}: {
  onThemeChange: (t: "system" | "light" | "dark") => void;
  extraSources?: PaletteSource[];
}) {
  const { paletteOpen, setPaletteOpen, setCreateWorkspaceOpen, setNewTaskOpen, setNewProjectOpen } = useShellUi();
  const { workspace, workspaces, role } = useWorkspace();
  const { setTheme } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [, start] = useTransition();
  const search = useWorkspaceSearch(workspace.id, query);

  const close = () => {
    setPaletteOpen(false);
    setQuery("");
  };
  const go = (href: string) => {
    if (query.trim().length >= 2) pushRecent(query.trim());
    close();
    router.push(href);
  };

  const staticGroups = useMemo<PaletteGroup[]>(() => {
    const actions: PaletteGroup = {
      id: "actions",
      heading: "Actions",
      items: [
        { id: "new-task", label: "New task", icon: SquarePlus, shortcut: "C", onSelect: () => { close(); setNewTaskOpen(true); } },
        ...(role !== "guest"
          ? [{ id: "new-project", label: "New project", icon: FolderPlus, shortcut: "N P", onSelect: () => { close(); setNewProjectOpen(true); } }]
          : []),
      ],
    };
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
          .map((w) => ({ id: `ws-${w.id}`, label: `Switch to ${w.name}`, icon: Building2, keywords: [w.slug], onSelect: () => go(`/w/${w.slug}`) })),
        { id: "ws-create", label: "Create workspace", icon: Plus, onSelect: () => { close(); setCreateWorkspaceOpen(true); } },
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
        ...ACCOUNT_SETTINGS.map((s) => ({ id: `settings-${s.href}`, label: `Open ${s.label.toLowerCase()} settings`, icon: Settings, keywords: ["settings", s.label], onSelect: () => go(s.href) })),
        { id: "sign-out", label: "Sign out", icon: LogOut, onSelect: () => { close(); start(() => signOut()); } },
      ],
    };
    return [actions, nav, switcher, prefs, account];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, workspace.slug, workspaces, role, query]);

  const keyJump = parseTaskKey(query);
  const results = search.data ?? [];
  const tasks = results.filter((r) => r.kind === "task");
  const projects = results.filter((r) => r.kind === "project");
  const people = results.filter((r) => r.kind === "member");
  const dynamicGroups = extraSources.map((s) => s({ query, close })).filter((g): g is PaletteGroup => Boolean(g));
  const searching = query.trim().length >= 2;

  const renderRows = (rows: SearchRow[], icon: LucideIcon) =>
    rows.map((r) => (
      <CommandItem key={`${r.kind}-${r.id}`} value={`${r.kind} ${r.title} ${r.subtitle} ${query}`} onSelect={() => go(r.url)}>
        {(() => {
          const I = icon;
          return <I className="size-4" aria-hidden />;
        })()}
        <span className="truncate">{r.title}</span>
        <span className="ml-auto truncate text-xs text-muted-foreground">{r.subtitle}</span>
      </CommandItem>
    ));

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={(o) => {
        if (o) {
          setRecent(readRecent());
          setPaletteOpen(true);
        } else close();
      }}
      title="Command palette"
      description="Search tasks, projects, members and commands"
    >
      <Command loop shouldFilter={!searching}>
        <CommandInput placeholder="Search tasks, projects, people… or type a command" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{search.isFetching ? "Searching…" : "No results found."}</CommandEmpty>
          {keyJump ? (
            <CommandGroup heading="Jump to">
              <CommandItem value={`jump ${query}`} onSelect={() => go(`/w/${workspace.slug}/t/${keyJump.projectKey}-${keyJump.number}`)}>
                <CheckSquare className="size-4" aria-hidden /> Open {keyJump.projectKey}-{keyJump.number}
              </CommandItem>
            </CommandGroup>
          ) : null}
          {searching ? (
            <>
              {tasks.length ? <CommandGroup heading="Tasks">{renderRows(tasks, CheckSquare)}</CommandGroup> : null}
              {projects.length ? <CommandGroup heading="Projects">{renderRows(projects, FolderKanban)}</CommandGroup> : null}
              {people.length ? <CommandGroup heading="Members">{renderRows(people, User)}</CommandGroup> : null}
              {search.isFetching && !results.length ? (
                <CommandGroup heading="Searching">
                  <CommandItem disabled value={`loading ${query}`}>Searching…</CommandItem>
                </CommandGroup>
              ) : null}
            </>
          ) : (
            <>
              {recent.length ? (
                <CommandGroup heading="Recent searches">
                  {recent.map((r) => (
                    <CommandItem key={`recent-${r}`} value={`recent ${r}`} onSelect={() => setQuery(r)}>
                      <Clock className="size-4" aria-hidden /> {r}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {[...dynamicGroups, ...staticGroups].map((g, gi) => (
                <div key={g.id}>
                  {gi > 0 || recent.length ? <CommandSeparator /> : null}
                  <CommandGroup heading={g.heading}>
                    {g.items.map((item) => (
                      <CommandItem key={item.id} value={`${item.label} ${(item.keywords ?? []).join(" ")}`} onSelect={item.onSelect}>
                        {item.icon ? <item.icon className="size-4" aria-hidden /> : null}
                        {item.label}
                        {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              ))}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
