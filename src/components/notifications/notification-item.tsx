"use client";

import { formatDistanceToNow } from "date-fns";
import { AtSign, Bell, CalendarClock, CircleAlert, FolderPlus, MessageSquare, RefreshCw, Trophy, UserCheck, type LucideIcon } from "lucide-react";
import type { NotificationRow } from "./use-notifications";
import { cn } from "@/lib/utils";

export const NOTIFICATION_META: Record<NotificationRow["type"], { label: string; icon: LucideIcon }> = {
  task_assigned: { label: "Assigned to you", icon: UserCheck },
  mentioned: { label: "Mentions", icon: AtSign },
  comment_on_assigned: { label: "Comments on your tasks", icon: MessageSquare },
  status_changed_on_assigned: { label: "Status changes", icon: RefreshCw },
  due_soon: { label: "Due soon", icon: CalendarClock },
  overdue: { label: "Overdue", icon: CircleAlert },
  invited_to_project: { label: "Added to projects", icon: FolderPlus },
  achievement_unlocked: { label: "Achievements", icon: Trophy },
  rebalance_suggested: { label: "Workload suggestions", icon: Bell },
};

export function NotificationItem({ n, active, onSelect }: { n: NotificationRow; active?: boolean; onSelect: () => void }) {
  const Icon = NOTIFICATION_META[n.type]?.icon ?? Bell;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted", active && "bg-muted")}
      aria-current={active ? "true" : undefined}
    >
      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", n.type === "overdue" ? "bg-danger/10 text-danger-text" : "bg-surface-2 text-muted-foreground")}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
        {n.body ? <span className="block truncate text-xs text-muted-foreground">{n.body}</span> : null}
        <time className="text-[11px] text-muted-foreground" dateTime={n.created_at}>
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </time>
      </span>
      {!n.read_at ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
    </button>
  );
}
