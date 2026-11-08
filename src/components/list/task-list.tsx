"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, ListTodo, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { bulkUpdateTasks, setAssignees } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { EmptyState } from "@/components/brand/empty-state";
import { PrioritiesDialog } from "@/components/ai/ai-dialogs";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { StatusIcon } from "@/components/brand/status-icon";
import { AvatarStack } from "@/components/common/visuals";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { BlockedDialog } from "@/components/tasks/blocked-dialog";
import { FilterBar, useTaskFilters } from "@/components/tasks/filter-bar";
import { AssigneePicker, PrioritySelect, StatusSelect } from "@/components/tasks/pickers";
import { dueChip } from "@/components/tasks/task-card";
import { useOpenTask } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useMoveTask } from "@/hooks/use-move-task";
import { useProjectTasks, useUpdateTask, type BoardTask } from "@/hooks/use-project-tasks";
import { matchesFilters, serializeFilters } from "@/lib/filters";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/domain";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type SortKey = "key" | "title" | "status" | "priority" | "due" | "effort" | "updated";
type GroupKey = "none" | "status" | "assignee" | "milestone" | "priority";
const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
const STATUS_RANK = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, i])) as Record<TaskStatus, number>;
const VIRTUAL_THRESHOLD = 200;

function compare(a: BoardTask, b: BoardTask, key: SortKey): number {
  switch (key) {
    case "key":
      return a.number - b.number;
    case "title":
      return a.title.localeCompare(b.title);
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case "due":
      return (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : (a.due_date ?? "9999") > (b.due_date ?? "9999") ? 1 : 0;
    case "effort":
      return (a.effort_points ?? 0) - (b.effort_points ?? 0);
    case "updated":
      return a.updated_at < b.updated_at ? 1 : -1;
  }
}

type Row = { kind: "group"; id: string; label: string; count: number } | { kind: "task"; task: BoardTask };

export function TaskList() {
  const { project, members, milestones, permissions, memberById } = useProject();
  const { user, workspace } = useWorkspace();
  const workspaceAi = workspace.aiEnabled !== false;
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filters] = useTaskFilters();
  const openTask = useOpenTask();
  const { data: tasks = [], isPending } = useProjectTasks(project.id);
  const update = useUpdateTask(project.id);
  const { move, blocked, clearBlocked } = useMoveTask(project.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
  const canEdit = permissions.canEditTasks;

  const sort = (params.get("sort") as SortKey) || "key";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";
  const group = (params.get("group") as GroupKey) || "status";
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const visible = useMemo(() => {
    const list = tasks.filter((t) => matchesFilters({ ...t, key: `${project.key}-${t.number}` }, filters, { userId: user.id, today }));
    list.sort((a, b) => compare(a, b, sort) * (dir === "desc" ? -1 : 1));
    return list;
  }, [tasks, filters, project.key, user.id, today, sort, dir]);

  const rows = useMemo<Row[]>(() => {
    if (group === "none") return visible.map((task) => ({ kind: "task", task }));
    const groups = new Map<string, { label: string; tasks: BoardTask[]; order: number }>();
    const add = (id: string, label: string, order: number, t: BoardTask) => {
      const g = groups.get(id) ?? { label, tasks: [], order };
      g.tasks.push(t);
      groups.set(id, g);
    };
    for (const t of visible) {
      if (group === "status") add(t.status, STATUS_LABELS[t.status], STATUS_RANK[t.status], t);
      else if (group === "priority") add(t.priority, PRIORITY_LABELS[t.priority], PRIORITY_RANK[t.priority], t);
      else if (group === "milestone") {
        const m = milestones.find((x) => x.id === t.milestone_id);
        add(m?.id ?? "none", m?.name ?? "No milestone", m ? m.sort_order : 9999, t);
      } else {
        if (t.assigneeIds.length === 0) add("unassigned", "Unassigned", 9999, t);
        for (const a of t.assigneeIds) add(a, memberById.get(a)?.profile.full_name ?? "Former member", 0, t);
      }
    }
    const out: Row[] = [];
    for (const [id, g] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order || a[1].label.localeCompare(b[1].label))) {
      out.push({ kind: "group", id, label: g.label, count: g.tasks.length });
      if (!collapsed.has(id)) for (const t of g.tasks) out.push({ kind: "task", task: t });
    }
    return out;
  }, [visible, group, milestones, memberById, collapsed]);

  const taskRows = rows.filter((r): r is Extract<Row, { kind: "task" }> => r.kind === "task");
  const virtual = rows.length > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 44, overscan: 12, enabled: virtual });

  const toggleSelect = (id: string, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && anchor) {
        const ids = taskRows.map((r) => r.task.id);
        const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y);
        if (a! >= 0 && b! >= 0) for (const x of ids.slice(a, b! + 1)) next.add(x);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchor(id);
  };

  useHotkeys([{ combo: "x", handler: () => focusId && canEdit && toggleSelect(focusId, false) }], canEdit);

  const runBulk = async (patch: Parameters<typeof bulkUpdateTasks>[0]["patch"], label: string) => {
    const ids = [...selected];
    const res = await bulkUpdateTasks({ ids, patch });
    if (!res.ok) return toast.error(res.error.message);
    const skipped = ids.length - res.data.updated;
    toast.success(`${label}: ${res.data.updated} task${res.data.updated === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped — no permission or blocked)` : ""}`);
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
  };

  const exportHref = `/api/export/tasks.csv?${serializeFilters(filters, new URLSearchParams({ projectId: project.id })).toString()}`;

  if (isPending) return <div className="h-64 animate-pulse rounded-xl bg-surface-2" role="status" aria-label="Loading list" />;

  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <th scope="col" className={cn("px-2 py-2 font-medium", className)} aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          if (sort === key) setParam("dir", dir === "asc" ? "desc" : null);
          else {
            const p = new URLSearchParams(params.toString());
            p.set("sort", key);
            p.delete("dir");
            router.replace(`${pathname}?${p.toString()}`, { scroll: false });
          }
        }}
      >
        {label}
        {sort === key ? dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
      </button>
    </th>
  );

  const renderTaskRow = (t: BoardTask, style?: React.CSSProperties) => {
    const key = `${project.key}-${t.number}`;
    const due = dueChip(t.due_date, t.status, today);
    const people = t.assigneeIds
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .map((m) => ({ id: m!.user_id, name: m!.profile.full_name, url: m!.profile.avatar_url }));
    const ms = milestones.find((m) => m.id === t.milestone_id);
    return (
      <tr
        key={t.id}
        style={style}
        className={cn("border-t text-sm hover:bg-surface-2/60", selected.has(t.id) && "bg-primary/5")}
        onFocus={() => setFocusId(t.id)}
        onMouseEnter={() => setFocusId(t.id)}
      >
        <td className="w-8 px-2">
          {canEdit ? (
            <Checkbox
              checked={selected.has(t.id)}
              aria-label={`Select ${key}`}
              onClick={(e) => {
                e.preventDefault();
                toggleSelect(t.id, e.shiftKey);
              }}
            />
          ) : null}
        </td>
        <td className="px-2 font-tabular text-xs whitespace-nowrap text-muted-foreground">{key}</td>
        <td className="min-w-56 px-2">
          <button type="button" className="block max-w-[32rem] truncate py-2 text-left font-medium hover:underline" onClick={() => openTask(key)}>
            {t.title}
          </button>
        </td>
        <td className="w-40 px-2">
          {canEdit ? (
            <StatusSelect
              value={t.status}
              className="h-7 border-transparent shadow-none"
              onChange={(s) => {
                const col = tasks.filter((x) => x.status === s && x.id !== t.id).sort((a, b) => a.position - b.position);
                void move(t.id, s, col.length ? col[col.length - 1]!.position : null, null);
              }}
            />
          ) : (
            <StatusIcon status={t.status} showLabel />
          )}
        </td>
        <td className="w-36 px-2">
          {canEdit ? (
            <PrioritySelect value={t.priority} className="h-7 border-transparent shadow-none" onChange={(p) => update.mutate({ id: t.id, patch: { priority: p } })} />
          ) : (
            <PriorityIcon priority={t.priority} showLabel />
          )}
        </td>
        <td className="w-40 px-2">
          {canEdit ? (
            <AssigneePicker
              value={t.assigneeIds}
              members={members}
              compact
              onChange={async (ids) => {
                const res = await setAssignees({ taskId: t.id, ids });
                if (!res.ok) toast.error(res.error.message);
                void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
              }}
            />
          ) : (
            <AvatarStack people={people} />
          )}
        </td>
        <td className="w-36 px-2">
          {canEdit ? (
            <Input
              type="date"
              aria-label={`Due date for ${key}`}
              value={t.due_date ?? ""}
              className={cn("h-7 border-transparent text-xs shadow-none", due?.tone === "overdue" && "text-danger-text", due?.tone === "soon" && "text-warning-text")}
              onChange={(e) => update.mutate({ id: t.id, patch: { due_date: e.target.value || null } })}
            />
          ) : (
            <span className="text-xs">{due?.text ?? "—"}</span>
          )}
        </td>
        <td className="w-16 px-2 text-center font-tabular text-xs">{t.effort_points ?? "—"}</td>
        <td className="hidden w-36 truncate px-2 text-xs text-muted-foreground xl:table-cell">{ms?.name ?? "—"}</td>
        <td className="hidden w-28 px-2 text-xs whitespace-nowrap text-muted-foreground lg:table-cell">{new Date(t.updated_at).toLocaleDateString()}</td>
      </tr>
    );
  };

  return (
    <div>
      <FilterBar>
        <Select value={group} onValueChange={(v) => setParam("group", v === "status" ? null : v)}>
          <SelectTrigger className="h-8 w-40" aria-label="Group by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Group: Status</SelectItem>
            <SelectItem value="assignee">Group: Assignee</SelectItem>
            <SelectItem value="milestone">Group: Milestone</SelectItem>
            <SelectItem value="priority">Group: Priority</SelectItem>
            <SelectItem value="none">No grouping</SelectItem>
          </SelectContent>
        </Select>
        {canEdit && workspaceAi ? <PrioritiesDialog projectId={project.id} currentPriority={Object.fromEntries(tasks.map((t) => [t.id, t.priority]))} /> : null}
        <Button asChild variant="outline" size="sm" className="h-8">
          <a href={exportHref} download>
            <Download className="size-3.5" aria-hidden /> Export CSV
          </a>
        </Button>
      </FilterBar>

      {visible.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={ListTodo}
            title={tasks.length ? "No tasks match filters" : "No tasks yet"}
            description={tasks.length ? "Try removing a filter." : "Create tasks from the Board or with the C shortcut."}
            primaryAction={tasks.length ? { label: "Clear filters", href: pathname } : undefined}
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div ref={scrollRef} className={cn("hidden overflow-x-auto rounded-xl border bg-card md:block", virtual && "max-h-[70vh] overflow-y-auto")}>
            <table className="w-full min-w-[960px] border-collapse" aria-rowcount={taskRows.length}>
              <thead className="sticky top-0 z-10 bg-surface-2 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-8 px-2">
                    <span className="sr-only">Select</span>
                    {canEdit ? (
                      <Checkbox
                        aria-label="Select all visible tasks"
                        checked={taskRows.length > 0 && taskRows.every((r) => selected.has(r.task.id))}
                        onCheckedChange={(v) => setSelected(v ? new Set(taskRows.map((r) => r.task.id)) : new Set())}
                      />
                    ) : null}
                  </th>
                  {sortHeader("key", "Key", "w-20")}
                  {sortHeader("title", "Title")}
                  {sortHeader("status", "Status", "w-40")}
                  {sortHeader("priority", "Priority", "w-36")}
                  <th scope="col" className="w-40 px-2 py-2 font-medium">Assignees</th>
                  {sortHeader("due", "Due", "w-36")}
                  {sortHeader("effort", "Effort", "w-16")}
                  <th scope="col" className="hidden w-36 px-2 py-2 font-medium xl:table-cell">Milestone</th>
                  {sortHeader("updated", "Updated", "hidden w-28 lg:table-cell")}
                </tr>
              </thead>
              <tbody style={virtual ? { height: virtualizer.getTotalSize(), position: "relative" } : undefined}>
                {(virtual ? virtualizer.getVirtualItems().map((v) => ({ row: rows[v.index]!, v })) : rows.map((row) => ({ row, v: null }))).map(({ row, v }) => {
                  const style: React.CSSProperties | undefined = v
                    ? { position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)`, display: "table" }
                    : undefined;
                  if (row.kind === "group") {
                    const open = !collapsed.has(row.id);
                    return (
                      <tr key={`g-${row.id}`} style={style} className="border-t bg-surface-2/40">
                        <td colSpan={10} className="px-2 py-1.5">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() =>
                              setCollapsed((c) => {
                                const n = new Set(c);
                                if (n.has(row.id)) n.delete(row.id);
                                else n.add(row.id);
                                return n;
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold"
                          >
                            {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                            {group === "status" ? <StatusIcon status={row.id as TaskStatus} /> : null}
                            {row.label}
                            <span className="font-tabular font-normal text-muted-foreground">{row.count}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  return renderTaskRow(row.task, style);
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="space-y-2 md:hidden" aria-label="Tasks">
            {rows.map((row) =>
              row.kind === "group" ? (
                <li key={`mg-${row.id}`} className="pt-2 text-xs font-semibold text-muted-foreground">
                  {row.label} · {row.count}
                </li>
              ) : (
                <Fragment key={row.task.id}>
                  <li className={cn("flex items-start gap-2 rounded-lg border bg-card p-3", selected.has(row.task.id) && "border-primary")}>
                    {canEdit ? (
                      <Checkbox className="mt-1" checked={selected.has(row.task.id)} aria-label={`Select ${project.key}-${row.task.number}`} onCheckedChange={() => toggleSelect(row.task.id, false)} />
                    ) : null}
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTask(`${project.key}-${row.task.number}`)}>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-tabular">{project.key}-{row.task.number}</span>
                        <StatusIcon status={row.task.status} />
                        <PriorityIcon priority={row.task.priority} />
                        {row.task.due_date ? <span>{dueChip(row.task.due_date, row.task.status, today)?.text}</span> : null}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium">{row.task.title}</span>
                    </button>
                  </li>
                </Fragment>
              ),
            )}
          </ul>
        </>
      )}

      {selected.size > 0 ? (
        <div role="toolbar" aria-label="Bulk actions" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-xl border bg-popover p-2 shadow-[var(--shadow-e3)] md:bottom-6">
          <span className="px-2 text-sm font-medium">{selected.size} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {TASK_STATUSES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => void runBulk({ status: s }, `Moved to ${STATUS_LABELS[s]}`)}>
                  <StatusIcon status={s} showLabel />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Priority</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {TASK_PRIORITIES.map((p) => (
                <DropdownMenuItem key={p} onSelect={() => void runBulk({ priority: p }, `Priority ${PRIORITY_LABELS[p]}`)}>
                  <PriorityIcon priority={p} showLabel />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Assignee</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Add</DropdownMenuLabel>
              {members.filter((m) => m.role !== "viewer").map((m) => (
                <DropdownMenuItem key={`a-${m.user_id}`} onSelect={() => void runBulk({ assignee_add: m.user_id }, `Assigned ${m.profile.full_name}`)}>
                  {m.profile.full_name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Remove</DropdownMenuLabel>
              {members.map((m) => (
                <DropdownMenuItem key={`r-${m.user_id}`} onSelect={() => void runBulk({ assignee_remove: m.user_id }, `Unassigned ${m.profile.full_name}`)}>
                  {m.profile.full_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {milestones.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Milestone</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => void runBulk({ milestone_id: "" }, "Removed milestone")}>No milestone</DropdownMenuItem>
                {milestones.map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => void runBulk({ milestone_id: m.id }, `Milestone ${m.name}`)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Input
            type="date"
            aria-label="Set due date for selected tasks"
            className="h-8 w-36"
            onChange={(e) => e.target.value && void runBulk({ due_date: e.target.value }, "Due date set")}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (window.confirm(`Delete ${selected.size} task(s)? Only tasks you're allowed to delete will be removed.`)) void runBulk({ delete: true }, "Deleted");
            }}
          >
            Delete
          </Button>
          <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <BlockedDialog state={blocked} onClose={clearBlocked} canOverride={permissions.canOverrideBlocked} />
    </div>
  );
}
