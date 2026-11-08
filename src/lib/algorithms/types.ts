/** Plain-data inputs for the pure algorithms (spec §G). Dates are ISO `YYYY-MM-DD` strings. */
import type { ProjectRole, TaskPriority, TaskStatus } from "@/lib/domain";

export type TaskLite = {
  id: string;
  key?: string;
  title?: string;
  parentTaskId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  effort: number | null;
  dueDate: string | null;
  startDate?: string | null;
  isBlocked: boolean;
  assigneeIds: string[];
  milestoneId?: string | null;
  /** Local date the task was created (YYYY-MM-DD) */
  createdDate?: string;
  /** Local date the task was completed (YYYY-MM-DD) */
  completedDate?: string | null;
  createdBy?: string | null;
};

export type DepLite = { blockerId: string; blockedId: string };

export type MemberLite = { userId: string; role: ProjectRole; capacity: number; name?: string };

export type ProjectLite = { startDate: string | null; targetDate: string | null };

export type MilestoneLite = { id: string; name: string; dueDate: string | null; status: "open" | "completed" };

/** One completed unit of effort on a day (for velocity / forecasts). */
export type CompletionPoint = { date: string; effort: number };

export type StatusChange = {
  taskId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  /** Local date of the change (YYYY-MM-DD) */
  date: string;
  /** ISO timestamp (for ordering within a day and cycle-time precision) */
  at?: string;
  effort?: number | null;
};

export type Severity = "high" | "medium" | "low";
