import {
  BarChart3,
  FolderKanban,
  Home,
  Inbox,
  ListChecks,
  Settings,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "home"
  | "my-tasks"
  | "inbox"
  | "projects"
  | "teams"
  | "members"
  | "analytics"
  | "leaderboard"
  | "settings";

export type NavItem = {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  /** Path relative to /w/[slug] */
  segment: string;
  description: string;
  /** Phase in which the full feature ships (1 = available now) */
  phase: 1 | 2 | 3 | 4;
};

export const PRIMARY_NAV: NavItem[] = [
  { key: "home", label: "Home", icon: Home, segment: "", description: "Your dashboard", phase: 1 },
  {
    key: "my-tasks",
    label: "My Tasks",
    icon: ListChecks,
    segment: "my-tasks",
    description: "Everything assigned to you across projects, grouped by due date.",
    phase: 2,
  },
  {
    key: "inbox",
    label: "Inbox",
    icon: Inbox,
    segment: "inbox",
    description: "Assignments, mentions and due-date notifications in one place.",
    phase: 2,
  },
  {
    key: "projects",
    label: "Projects",
    icon: FolderKanban,
    segment: "projects",
    description: "Plan projects into milestones and tasks with boards, lists and calendars.",
    phase: 2,
  },
  {
    key: "teams",
    label: "Teams",
    icon: UsersRound,
    segment: "teams",
    description: "Group members (e.g. Frontend, Design) to add them to projects in one go.",
    phase: 2,
  },
  {
    key: "members",
    label: "Members",
    icon: Users,
    segment: "members",
    description: "People in this workspace and their roles.",
    phase: 1,
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    segment: "analytics",
    description: "Burndown, throughput, workload and contribution charts from real activity.",
    phase: 3,
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    segment: "leaderboard",
    description: "XP, levels and streaks earned by completing work.",
    phase: 3,
  },
];

export const SETTINGS_NAV: NavItem = {
  key: "settings",
  label: "Settings",
  icon: Settings,
  segment: "settings",
  description: "Workspace name, members and invites, AI and gamification settings.",
  phase: 2,
};

export function workspaceHref(slug: string, segment = ""): string {
  return segment ? `/w/${slug}/${segment}` : `/w/${slug}`;
}

/** Which nav key matches a pathname like /w/acme/projects/… */
export function activeNavKey(pathname: string, slug: string): NavKey | null {
  const base = `/w/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "home";
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : "";
  const first = rest.split("/")[0] ?? "";
  if (first === "p") return "projects";
  const all = [...PRIMARY_NAV, SETTINGS_NAV];
  return all.find((n) => n.segment && n.segment === first)?.key ?? null;
}

export const ACCOUNT_SETTINGS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/security", label: "Security" },
] as const;
