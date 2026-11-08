import type { TaskPriority, TaskStatus } from "@/lib/domain";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain";
import { addDays, endOfWeek, format } from "date-fns";

/** Shared Board/List/Calendar filters, serialised to URL query params (spec §B.17). */
export type DueFilter = "overdue" | "today" | "week" | "none";

export type TaskFilters = {
  assignee: string[]; // user ids, plus "me" | "unassigned"
  status: TaskStatus[];
  priority: TaskPriority[];
  label: string[];
  milestone: string[]; // ids, plus "none"
  due: DueFilter | null;
  blocked: boolean | null;
  q: string;
};

export const EMPTY_FILTERS: TaskFilters = {
  assignee: [],
  status: [],
  priority: [],
  label: [],
  milestone: [],
  due: null,
  blocked: null,
  q: "",
};

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export function parseFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): TaskFilters {
  const get = (k: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(k);
    const v = params[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const due = get("due");
  const blocked = get("blocked");
  return {
    assignee: list(get("assignee")).slice(0, 20),
    status: list(get("status")).filter((s): s is TaskStatus => (TASK_STATUSES as string[]).includes(s)),
    priority: list(get("priority")).filter((p): p is TaskPriority => (TASK_PRIORITIES as string[]).includes(p)),
    label: list(get("label")).slice(0, 20),
    milestone: list(get("milestone")).slice(0, 20),
    due: due === "overdue" || due === "today" || due === "week" || due === "none" ? due : null,
    blocked: blocked === "true" ? true : blocked === "false" ? false : null,
    q: (get("q") ?? "").slice(0, 100),
  };
}

export function serializeFilters(f: TaskFilters, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
  set("assignee", f.assignee.join(",") || null);
  set("status", f.status.join(",") || null);
  set("priority", f.priority.join(",") || null);
  set("label", f.label.join(",") || null);
  set("milestone", f.milestone.join(",") || null);
  set("due", f.due);
  set("blocked", f.blocked === null ? null : String(f.blocked));
  set("q", f.q.trim() || null);
  return p;
}

export function activeFilterCount(f: TaskFilters): number {
  return (
    f.assignee.length +
    f.status.length +
    f.priority.length +
    f.label.length +
    f.milestone.length +
    (f.due ? 1 : 0) +
    (f.blocked !== null ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  );
}

export type FilterableTask = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  is_blocked: boolean;
  milestone_id: string | null;
  assigneeIds: string[];
  labelIds: string[];
  key?: string;
};

/** Pure client-side filter (the same rules the server query applies). `today` = YYYY-MM-DD. */
export function matchesFilters(t: FilterableTask, f: TaskFilters, ctx: { userId: string; today: string; weekStartsOn?: 0 | 1 }): boolean {
  if (f.status.length && !f.status.includes(t.status)) return false;
  if (f.priority.length && !f.priority.includes(t.priority)) return false;
  if (f.assignee.length) {
    const ok = f.assignee.some((a) =>
      a === "me" ? t.assigneeIds.includes(ctx.userId) : a === "unassigned" ? t.assigneeIds.length === 0 : t.assigneeIds.includes(a),
    );
    if (!ok) return false;
  }
  if (f.label.length && !f.label.some((l) => t.labelIds.includes(l))) return false;
  if (f.milestone.length) {
    const ok = f.milestone.some((m) => (m === "none" ? t.milestone_id === null : t.milestone_id === m));
    if (!ok) return false;
  }
  if (f.blocked !== null && t.is_blocked !== f.blocked) return false;
  if (f.due) {
    const open = t.status !== "done" && t.status !== "cancelled";
    if (f.due === "none" && t.due_date !== null) return false;
    if (f.due === "overdue" && !(open && t.due_date !== null && t.due_date < ctx.today)) return false;
    if (f.due === "today" && t.due_date !== ctx.today) return false;
    if (f.due === "week") {
      const end = format(endOfWeek(new Date(`${ctx.today}T00:00:00`), { weekStartsOn: ctx.weekStartsOn ?? 1 }), "yyyy-MM-dd");
      if (!(t.due_date !== null && t.due_date >= ctx.today && t.due_date <= end)) return false;
    }
  }
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    if (!t.title.toLowerCase().includes(q) && !(t.key ?? "").toLowerCase().includes(q)) return false;
  }
  return true;
}

/** Due-date bucket for My Tasks grouping. */
export function dueBucket(due: string | null, today: string): "overdue" | "today" | "week" | "later" | "none" {
  if (!due) return "none";
  if (due < today) return "overdue";
  if (due === today) return "today";
  const in7 = format(addDays(new Date(`${today}T00:00:00`), 7), "yyyy-MM-dd");
  return due <= in7 ? "week" : "later";
}
