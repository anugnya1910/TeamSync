import { STATUS_LABELS, PRIORITY_LABELS, ROLE_LABELS, PROJECT_ROLE_LABELS } from "@/lib/domain";
import type { Json } from "@/types/database";

export type ActivityLog = {
  id: number;
  action: string;
  actor_id: string | null;
  metadata: Json;
  created_at: string;
  task_id?: string | null;
  project_id?: string | null;
};

type Meta = Record<string, unknown>;

const label = (map: Record<string, string>, v: unknown) => (typeof v === "string" && map[v]) || String(v ?? "—");

/** Renders an activity row as a human sentence without joins (spec §B.15). Markdown-ish **bold** for keys. */
export function describeActivity(log: ActivityLog, actorName: string): string {
  const m = (log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? log.metadata : {}) as Meta;
  const key = m.key ? `**${String(m.key)}**` : "a task";
  const who = actorName || "Someone";
  switch (log.action) {
    case "task.created":
      return `${who} created ${key} ${m.title ? `“${String(m.title)}”` : ""}`.trim();
    case "task.status_changed":
      return `${who} moved ${key} from ${label(STATUS_LABELS, m.from)} → ${label(STATUS_LABELS, m.to)}${
        m.override_reason ? ` (override: ${String(m.override_reason)})` : ""
      }`;
    case "task.updated":
      switch (m.field) {
        case "priority":
          return `${who} changed priority of ${key} to ${label(PRIORITY_LABELS, m.to)}`;
        case "title":
          return `${who} renamed ${key} to “${String(m.to ?? "")}”`;
        case "due_date":
          return m.to ? `${who} set ${key} due ${String(m.to)}` : `${who} cleared the due date of ${key}`;
        case "milestone":
          return m.to ? `${who} moved ${key} to milestone ${String(m.to)}` : `${who} removed ${key} from its milestone`;
        default:
          return `${who} updated ${key}`;
      }
    case "task.assigned":
      return `${who} assigned ${String(m.user_name ?? "someone")} to ${key}`;
    case "task.unassigned":
      return `${who} unassigned ${String(m.user_name ?? "someone")} from ${key}`;
    case "task.deleted":
      return `${who} deleted ${key}`;
    case "task.restored":
      return `${who} restored ${key}`;
    case "comment.added":
      return `${who} commented on ${key}`;
    case "project.created":
      return `${who} created project **${String(m.project_name ?? "")}**`;
    case "project.archived":
      return `${who} archived **${String(m.project_name ?? "")}**`;
    case "project.restored":
      return `${who} restored **${String(m.project_name ?? "")}**`;
    case "project.deleted":
      return `${who} deleted project **${String(m.project_name ?? "")}**`;
    case "project.member_added":
      return `${who} added ${String(m.user_name ?? "someone")} to **${String(m.project_name ?? "")}** as ${label(PROJECT_ROLE_LABELS, m.role)}`;
    case "project.member_removed":
      return `${who} removed ${String(m.user_name ?? "someone")} from **${String(m.project_name ?? "")}**`;
    case "project.member_role_changed":
      return `${who} made ${String(m.user_name ?? "someone")} ${label(PROJECT_ROLE_LABELS, m.to)} on **${String(m.project_name ?? "")}**`;
    case "member.joined":
      return `${String(m.user_name ?? who)} joined the workspace as ${label(ROLE_LABELS, m.role)}`;
    case "member.left":
      return m.removed_by_other ? `${who} removed ${String(m.user_name ?? "a member")}` : `${String(m.user_name ?? who)} left the workspace`;
    case "member.role_changed":
      return `${who} changed ${String(m.user_name ?? "a member")}'s role to ${label(ROLE_LABELS, m.to)}`;
    default:
      return `${who} made a change`;
  }
}

/** Splits "**bold**" segments for safe rendering without HTML. */
export function boldSegments(sentence: string): { text: string; bold: boolean }[] {
  return sentence.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((s) =>
    s.startsWith("**") && s.endsWith("**") ? { text: s.slice(2, -2), bold: true } : { text: s, bold: false },
  );
}
