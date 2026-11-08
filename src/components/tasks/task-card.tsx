"use client";

import { AlertOctagon, CheckSquare, MessageSquare } from "lucide-react";
import { memo } from "react";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { AvatarStack } from "@/components/common/visuals";
import type { ProjectMember } from "@/lib/data/project";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";
import type { BoardTask } from "@/hooks/use-project-tasks";
import { LabelChip } from "./pickers";

export function dueChip(due: string | null, status: string, today: string): { text: string; tone: "overdue" | "soon" | "normal" } | null {
  if (!due) return null;
  const open = status !== "done" && status !== "cancelled";
  const d = new Date(`${due}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  const text = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (open && days < 0) return { text, tone: "overdue" };
  if (open && days <= 2) return { text, tone: "soon" };
  return { text, tone: "normal" };
}

type Props = {
  task: BoardTask;
  projectKey: string;
  memberById: Map<string, ProjectMember>;
  labelsById: Map<string, Tables<"labels">>;
  subtasks?: { done: number; total: number };
  today: string;
  dragging?: boolean;
  overlay?: boolean;
  menu?: React.ReactNode;
  /** Keys of open tasks blocking this one (effective blocked, spec §B.12) */
  blockedBy?: string[];
};

/** Board card per spec §B.9. Memoised: re-renders only when its task changes. */
export const TaskCard = memo(function TaskCard({ task, projectKey, memberById, labelsById, subtasks, today, dragging, overlay, menu, blockedBy = [] }: Props) {
  const blocked = task.is_blocked || blockedBy.length > 0;
  const blockedTitle = [task.is_blocked ? `Marked blocked${task.blocked_reason ? `: ${task.blocked_reason}` : ""}` : null, blockedBy.length ? `Waiting on ${blockedBy.join(", ")}` : null].filter(Boolean).join(" · ");
  const labels = task.labelIds.map((id) => labelsById.get(id)).filter((l): l is Tables<"labels"> => Boolean(l));
  const people = task.assigneeIds
    .map((id) => memberById.get(id))
    .filter((m): m is ProjectMember => Boolean(m))
    .map((m) => ({ id: m.user_id, name: m.profile.full_name, url: m.profile.avatar_url }));
  const due = dueChip(task.due_date, task.status, today);

  return (
    <div
      className={cn(
        "group relative space-y-2 rounded-lg border bg-card p-2.5 text-left shadow-[var(--shadow-e1)] transition-shadow",
        dragging && "opacity-40",
        overlay && "rotate-2 shadow-[var(--shadow-e3)] ring-2 ring-primary/40",
        blocked && "border-danger/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-tabular text-[11px] text-muted-foreground">
          {projectKey}-{task.number}
        </span>
        {blocked ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-danger/10 px-1 text-[10px] font-semibold text-danger-text" title={blockedTitle}>
            <AlertOctagon className="size-3" aria-hidden /> 🔒 Blocked
            <span className="sr-only">. {blockedTitle}</span>
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          <PriorityIcon priority={task.priority} />
          {menu}
        </span>
      </div>
      <p className={cn("text-sm leading-snug font-medium", task.status === "cancelled" && "text-muted-foreground line-through")}>{task.title}</p>
      {labels.length ? (
        <div className="flex flex-wrap gap-1">
          {labels.slice(0, 3).map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {labels.length > 3 ? <span className="text-[11px] text-muted-foreground">+{labels.length - 3}</span> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {due ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-medium",
              due.tone === "overdue" && "bg-danger/10 text-danger-text",
              due.tone === "soon" && "bg-warning/15 text-warning-text",
              due.tone === "normal" && "bg-surface-2",
            )}
          >
            {due.tone === "overdue" ? "Overdue · " : ""}
            {due.text}
          </span>
        ) : null}
        {subtasks && subtasks.total > 0 ? (
          <span className="inline-flex items-center gap-0.5" aria-label={`${subtasks.done} of ${subtasks.total} subtasks done`}>
            <CheckSquare className="size-3" aria-hidden /> {subtasks.done}/{subtasks.total}
          </span>
        ) : null}
        {task.commentCount ? (
          <span className="inline-flex items-center gap-0.5" aria-label={`${task.commentCount} comments`}>
            <MessageSquare className="size-3" aria-hidden /> {task.commentCount}
          </span>
        ) : null}
        {task.effort_points ? (
          <span className="rounded border px-1 font-tabular" aria-label={`${task.effort_points} effort points`}>
            {task.effort_points}
          </span>
        ) : null}
        <span className="ml-auto">
          <AvatarStack people={people} max={3} size="size-5" />
        </span>
      </div>
    </div>
  );
});
