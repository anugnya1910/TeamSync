import type { Enums } from "@/types/database";

export type TaskStatus = Enums<"task_status">;
export type TaskPriority = Enums<"task_priority">;
export type WorkspaceRole = Enums<"workspace_role">;
export type ProjectRole = Enums<"project_role">;
export type ProjectStatus = Enums<"project_status">;

export const TASK_STATUSES: readonly TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
] as const;

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  lead: "Lead",
  contributor: "Contributor",
  viewer: "Viewer",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};
