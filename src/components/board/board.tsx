"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, KanbanSquare, MoreVertical, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createTask } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { EmptyState } from "@/components/brand/empty-state";
import { StatusIcon } from "@/components/brand/status-icon";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { BlockedDialog } from "@/components/tasks/blocked-dialog";
import { FilterBar, useTaskFilters } from "@/components/tasks/filter-bar";
import { TaskCard } from "@/components/tasks/task-card";
import { useOpenTask } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useMoveTask } from "@/hooks/use-move-task";
import { useProjectTasks, type BoardTask } from "@/hooks/use-project-tasks";
import { matchesFilters } from "@/lib/filters";
import { STATUS_LABELS, type TaskStatus } from "@/lib/domain";
import { useReducedMotionPreference } from "@/lib/motion";
import { qk } from "@/lib/query-keys";
import { neighboursForIndex } from "@/lib/utils/fractional-index";
import { cn } from "@/lib/utils";

const BASE_COLUMNS: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
const RENDER_CHUNK = 60;

type Columns = Record<TaskStatus, string[]>;

function SortableCard({ id, disabled, children, label }: { id: string; disabled: boolean; children: React.ReactNode; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const reduced = useReducedMotionPreference();
  return (
    <motion.li
      layout={reduced ? false : "position"}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("list-none touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      aria-roledescription={disabled ? undefined : "draggable task"}
      aria-label={label}
    >
      {children}
    </motion.li>
  );
}

function ColumnDrop({ status, children }: { status: TaskStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <ul ref={setNodeRef} className={cn("flex min-h-24 flex-col gap-2 rounded-lg p-1 transition-colors", isOver && "bg-primary/5")}>
      {children}
    </ul>
  );
}

function QuickAdd({ status, onCreated }: { status: TaskStatus; onCreated: () => void }) {
  const { project } = useProject();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" aria-hidden /> Add task
      </Button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t || busy) return;
        setBusy(true);
        const res = await createTask({ projectId: project.id, title: t, status });
        setBusy(false);
        if (!res.ok) return toast.error(res.error.message);
        setTitle(""); // stays open for the next one
        onCreated();
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={() => !title.trim() && setOpen(false)}
        placeholder="Task title, Enter to add"
        aria-label={`New task in ${STATUS_LABELS[status]}`}
        maxLength={200}
        disabled={busy}
        className="h-8"
      />
    </form>
  );
}

export function Board() {
  const { project, labels, permissions, memberById } = useProject();
  const { user } = useWorkspace();
  const qc = useQueryClient();
  const { data: tasks = [], isPending, isError } = useProjectTasks(project.id);
  const [filters] = useTaskFilters();
  const openTask = useOpenTask();
  const { move, blocked, clearBlocked } = useMoveTask(project.id);
  const [backlogOpen, setBacklogOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("todo");
  const [limits, setLimits] = useState<Record<string, number>>({});
  const canDrag = permissions.canEditTasks;
  const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const wip = (project.wip_limits ?? {}) as Record<string, number>;

  const showCancelled = filters.status.includes("cancelled");
  const statuses = useMemo<TaskStatus[]>(() => (showCancelled ? [...BASE_COLUMNS, "cancelled"] : BASE_COLUMNS), [showCancelled]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const subtaskStats = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const t of tasks) {
      if (!t.parent_task_id) continue;
      const s = m.get(t.parent_task_id) ?? { done: 0, total: 0 };
      s.total += 1;
      if (t.status === "done") s.done += 1;
      m.set(t.parent_task_id, s);
    }
    return m;
  }, [tasks]);

  const visible = useMemo(
    () =>
      tasks.filter((t) =>
        matchesFilters({ ...t, key: `${project.key}-${t.number}` }, filters, { userId: user.id, today }),
      ),
    [tasks, filters, project.key, user.id, today],
  );

  const baseCols = useMemo(() => {
    const c = Object.fromEntries(statuses.map((s) => [s, [] as string[]])) as unknown as Columns;
    for (const t of [...visible].sort((a, b) => a.position - b.position)) c[t.status]?.push(t.id);
    return c;
  }, [visible, statuses]);
  const cols = dragCols ?? baseCols;

  const findCol = (id: string): TaskStatus | null => {
    if (id.startsWith("col:")) return id.slice(4) as TaskStatus;
    return (Object.keys(cols) as TaskStatus[]).find((s) => cols[s].includes(id)) ?? null;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const keyOf = (id: string | number) => {
    const t = byId.get(String(id));
    return t ? `${project.key}-${t.number}` : "task";
  };
  const posText = (overId: string | number | undefined) => {
    if (!overId) return "";
    const col = findCol(String(overId));
    if (!col) return "";
    const idx = cols[col].indexOf(String(overId));
    return `${STATUS_LABELS[col]}${idx >= 0 ? `, position ${idx + 1} of ${cols[col].length}` : ""}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${keyOf(active.id)}. Use arrow keys to move, space to drop, escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${keyOf(active.id)} is over ${posText(over.id)}.` : `${keyOf(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `Moved ${keyOf(active.id)} to ${posText(over.id)}.` : `${keyOf(active.id)} was dropped.`),
    onDragCancel: ({ active }) => `Moving ${keyOf(active.id)} was cancelled.`,
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setDragCols(baseCols);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragCols) return;
    const from = findCol(String(active.id));
    const to = findCol(String(over.id));
    if (!from || !to || from === to) return;
    setDragCols((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [from]: prev[from].filter((x) => x !== active.id), [to]: [...prev[to]] };
      const overIdx = next[to].indexOf(String(over.id));
      next[to].splice(overIdx >= 0 ? overIdx : next[to].length, 0, String(active.id));
      return next;
    });
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const current = dragCols;
    setActiveId(null);
    if (!over || !current) {
      setDragCols(null);
      return;
    }
    const to = findCol(String(over.id));
    if (!to) {
      setDragCols(null);
      return;
    }
    const list = [...current[to]];
    const from = list.indexOf(id);
    let target = String(over.id).startsWith("col:") ? list.length - 1 : list.indexOf(String(over.id));
    if (from >= 0 && target >= 0 && from !== target) {
      list.splice(from, 1);
      list.splice(target, 0, id);
    }
    target = list.indexOf(id);
    const columnTasks = list.map((x) => byId.get(x)!).filter(Boolean);
    const { before, after } = neighboursForIndex(columnTasks, id, target);
    const task = byId.get(id);
    setDragCols(null);
    if (!task || (task.status === to && list.join() === baseCols[to]?.join())) return;
    await move(id, to, before, after);
  };

  const moveTo = (task: BoardTask, status: TaskStatus) => {
    const col = (cols[status] ?? []).map((x) => byId.get(x)!).filter(Boolean);
    void move(task.id, status, col.length ? col[col.length - 1]!.position : null, null);
  };

  if (isPending) return <BoardSkeleton />;
  if (isError) return <p className="text-sm text-danger-text">Couldn&apos;t load tasks. Refresh to try again.</p>;

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
  const activeTask = activeId ? byId.get(activeId) : null;
  const cardMenu = (t: BoardTask) =>
    canDrag ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-6 place-items-center rounded text-muted-foreground opacity-100 hover:bg-muted md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
            aria-label={`Move ${project.key}-${t.number} to…`}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel>Move to…</DropdownMenuLabel>
          {statuses
            .filter((s) => s !== t.status)
            .map((s) => (
              <DropdownMenuItem key={s} onSelect={() => moveTo(t, s)}>
                <StatusIcon status={s} showLabel />
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const column = (status: TaskStatus) => {
    const ids = cols[status] ?? [];
    const colTasks = ids.map((x) => byId.get(x)!).filter(Boolean);
    const effort = colTasks.reduce((s, t) => s + (t.effort_points ?? 0), 0);
    const limit = wip[status];
    const over = typeof limit === "number" && colTasks.length > limit;
    const collapsed = status === "backlog" && !backlogOpen;
    const shown = limits[status] ?? RENDER_CHUNK;
    return (
      <section
        key={status}
        id={`col-${status}`}
        aria-label={`${STATUS_LABELS[status]} column, ${colTasks.length} tasks`}
        className={cn(
          "flex w-[85vw] shrink-0 snap-start flex-col rounded-xl border bg-surface-2/60 sm:w-72 md:w-auto md:min-w-64 md:flex-1",
          over && "border-warning ring-1 ring-warning/50",
          collapsed && "md:min-w-0 md:flex-none md:w-12",
        )}
      >
        <header className="flex items-center gap-2 px-3 py-2.5">
          {status === "backlog" ? (
            <button
              type="button"
              onClick={() => setBacklogOpen((v) => !v)}
              aria-expanded={backlogOpen}
              aria-label={backlogOpen ? "Collapse backlog" : "Expand backlog"}
              className="hidden rounded text-muted-foreground hover:text-foreground md:block"
            >
              {backlogOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            </button>
          ) : null}
          {!collapsed ? (
            <>
              <StatusIcon status={status} showLabel className="text-sm font-semibold" />
              <span className="ml-auto flex items-center gap-2 font-tabular text-xs text-muted-foreground">
                <span aria-label={`${colTasks.length} tasks`}>{colTasks.length}{typeof limit === "number" ? `/${limit}` : ""}</span>
                <span aria-label={`${effort} effort points`}>· {effort} pts</span>
              </span>
            </>
          ) : null}
        </header>
        {over ? <p className="px-3 pb-1 text-xs text-warning-text">WIP limit exceeded</p> : null}
        {!collapsed ? (
          <div className="flex-1 px-2 pb-2">
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ColumnDrop status={status}>
                {colTasks.slice(0, shown).map((t) => (
                  <SortableCard key={t.id} id={t.id} disabled={!canDrag} label={`${project.key}-${t.number}: ${t.title}`}>
                    <div
                      role="button"
                      tabIndex={-1}
                      onClick={() => openTask(`${project.key}-${t.number}`)}
                      onKeyDown={(e) => e.key === "Enter" && openTask(`${project.key}-${t.number}`)}
                      className="cursor-pointer rounded-lg"
                    >
                      <TaskCard
                        task={t}
                        projectKey={project.key}
                        memberById={memberById}
                        labelsById={labelsById}
                        subtasks={subtaskStats.get(t.id)}
                        today={today}
                        menu={cardMenu(t)}
                      />
                    </div>
                  </SortableCard>
                ))}
                {colTasks.length === 0 ? (
                  <li className="grid min-h-20 place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">Drop tasks here</li>
                ) : null}
              </ColumnDrop>
            </SortableContext>
            {colTasks.length > shown ? (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setLimits((l) => ({ ...l, [status]: shown + RENDER_CHUNK }))}>
                Show {Math.min(RENDER_CHUNK, colTasks.length - shown)} more
              </Button>
            ) : null}
            {permissions.canEditTasks && status !== "cancelled" ? <QuickAdd status={status} onCreated={refresh} /> : null}
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <div>
      <FilterBar>
        <span className="text-xs text-muted-foreground">{visible.length} of {tasks.length} tasks</span>
      </FilterBar>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={KanbanSquare}
            title="No tasks yet"
            description={permissions.canEditTasks ? "Add the first task with “Add task” in any column, or press C." : "Tasks will appear here once your team adds them."}
          />
        </div>
      ) : null}

      {/* Mobile status tab bar (spec §B.9 mobile) */}
      <div className="sticky top-14 z-10 -mx-4 mb-2 flex gap-1 overflow-x-auto bg-background/90 px-4 py-1 backdrop-blur md:hidden" role="tablist" aria-label="Board columns">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={mobileStatus === s}
            onClick={() => {
              setMobileStatus(s);
              document.getElementById(`col-${s}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
            }}
            className={cn("min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium", mobileStatus === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
          >
            {STATUS_LABELS[s]} <span className="font-tabular">{cols[s]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <DndContext
        sensors={canDrag ? sensors : undefined}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragCols(null);
        }}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "To pick up a task, press space or enter. Use arrow keys to move it, then press space or enter to drop, or escape to cancel." } }}
      >
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0"
          data-testid="board"
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollLeft / (el.firstElementChild?.clientWidth ?? 1));
            const s = statuses[Math.min(idx, statuses.length - 1)];
            if (s && s !== mobileStatus) setMobileStatus(s);
          }}
        >
          {statuses.map((s) => column(s))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              projectKey={project.key}
              memberById={memberById}
              labelsById={labelsById}
              subtasks={subtaskStats.get(activeTask.id)}
              today={today}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <BlockedDialog state={blocked} onClose={clearBlocked} canOverride={permissions.canOverrideBlocked} />
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" role="status" aria-label="Loading board">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-80 w-72 shrink-0 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}
