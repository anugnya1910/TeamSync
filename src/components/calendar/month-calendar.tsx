"use client";

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, ChevronLeft, ChevronRight, Diamond, Inbox } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { FilterBar, useTaskFilters } from "@/components/tasks/filter-bar";
import { useOpenTask } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useProjectTasks, useUpdateTask, type BoardTask } from "@/hooks/use-project-tasks";
import { matchesFilters } from "@/lib/filters";
import type { TaskPriority } from "@/lib/domain";
import { cn } from "@/lib/utils";

const STRIP: Record<TaskPriority, string> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
  none: "var(--border)",
};
const MAX_PER_DAY = 3;

function Chip({ task, projectKey, draggable, onOpen }: { task: BoardTask; projectKey: string; draggable: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onOpen}
      aria-label={`${projectKey}-${task.number}: ${task.title}${draggable ? ". Draggable to another day" : ""}`}
      className={cn(
        "flex w-full items-center gap-1 overflow-hidden rounded border-l-[3px] bg-card px-1.5 py-0.5 text-left text-[11px] shadow-[var(--shadow-e1)] hover:bg-muted",
        task.status === "done" && "opacity-60 line-through",
        isDragging && "opacity-40",
      )}
      style={{ borderLeftColor: STRIP[task.priority] }}
    >
      <span className="font-tabular text-muted-foreground">{task.number}</span>
      <span className="truncate">{task.title}</span>
    </button>
  );
}

function DayCell({ iso, children, muted, isToday }: { iso: string; children: React.ReactNode; muted: boolean; isToday: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={format(parseISO(iso), "EEEE d MMMM")}
      className={cn("min-h-28 border-t border-l p-1", muted && "bg-surface-2/50", isOver && "bg-primary/10")}
    >
      <div className={cn("mb-1 grid size-6 place-items-center rounded-full text-xs", isToday ? "bg-primary font-semibold text-primary-foreground" : muted ? "text-muted-foreground" : "")}>
        {parseISO(iso).getDate()}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function UnscheduledDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "day:none" });
  return (
    <div ref={setNodeRef} className={cn("space-y-1 rounded-lg p-1", isOver && "bg-primary/10")}>
      {children}
    </div>
  );
}

export function MonthCalendar() {
  const { project, milestones, permissions } = useProject();
  const { user } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filters] = useTaskFilters();
  const openTask = useOpenTask();
  const { data: tasks = [], isPending } = useProjectTasks(project.id);
  const update = useUpdateTask(project.id);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);
  const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
  const monthParam = params.get("month");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? parseISO(`${monthParam}-01`) : parseISO(`${today.slice(0, 7)}-01`);
  const weekStartsOn = user.weekStart;
  const canDrag = permissions.canEditTasks;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const setMonth = (d: Date | null) => {
    const p = new URLSearchParams(params.toString());
    if (d) p.set("month", format(d, "yyyy-MM"));
    else p.delete("month");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const visible = tasks.filter((t) => matchesFilters({ ...t, key: `${project.key}-${t.number}` }, filters, { userId: user.id, today }));
  const byDay = new Map<string, BoardTask[]>();
  for (const t of visible) if (t.due_date) byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);
  const unscheduled = visible.filter((t) => !t.due_date && t.status !== "done" && t.status !== "cancelled");

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  });
  const weekdayLabels = days.slice(0, 7).map((d) => format(d, "EEE"));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const iso = String(over.id).slice(4);
    const due = iso === "none" ? null : iso;
    const t = tasks.find((x) => x.id === active.id);
    if (!t || t.due_date === due) return;
    if (due && t.start_date && t.start_date > due) {
      update.mutate({ id: t.id, patch: { due_date: due, start_date: null } });
    } else update.mutate({ id: t.id, patch: { due_date: due } });
  };

  if (isPending) return <div className="h-96 animate-pulse rounded-xl bg-surface-2" role="status" aria-label="Loading calendar" />;

  const unscheduledList = (
    <UnscheduledDrop>
      {unscheduled.length ? (
        unscheduled.map((t) => <Chip key={t.id} task={t} projectKey={project.key} draggable={canDrag} onOpen={() => openTask(`${project.key}-${t.number}`)} />)
      ) : (
        <p className="p-2 text-xs text-muted-foreground">Every open task has a due date.</p>
      )}
    </UnscheduledDrop>
  );

  return (
    <div>
      <FilterBar>
        <Sheet open={unscheduledOpen} onOpenChange={setUnscheduledOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Inbox className="size-3.5" aria-hidden /> Unscheduled ({unscheduled.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Unscheduled tasks</SheetTitle>
              <SheetDescription>{canDrag ? "Drag a task onto a day in the calendar to set its due date." : "Open tasks without a due date."}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4">{unscheduledList}</div>
          </SheetContent>
        </Sheet>
      </FilterBar>

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-section min-w-40">{format(month, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(null)}>
          Today
        </Button>
      </div>

      <DndContext sensors={canDrag ? sensors : undefined} onDragEnd={onDragEnd}>
        {/* Desktop month grid */}
        <div className="hidden overflow-hidden rounded-xl border-r border-b bg-card md:block" role="grid" aria-label={`Calendar ${format(month, "MMMM yyyy")}`}>
          <div className="grid grid-cols-7 bg-surface-2 text-xs font-medium text-muted-foreground" role="row">
            {weekdayLabels.map((l) => (
              <div key={l} className="border-l px-2 py-1.5" role="columnheader">
                {l}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" role="row">
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const list = byDay.get(iso) ?? [];
              const ms = milestones.filter((m) => m.due_date === iso);
              return (
                <DayCell key={iso} iso={iso} muted={!isSameMonth(d, month)} isToday={iso === today}>
                  {ms.map((m) => (
                    <p key={m.id} className="flex items-center gap-1 truncate text-[11px] font-semibold text-accent-text">
                      <Diamond className="size-3 shrink-0 fill-current" aria-hidden /> {m.name}
                      <span className="sr-only">milestone due</span>
                    </p>
                  ))}
                  {list.slice(0, MAX_PER_DAY).map((t) => (
                    <Chip key={t.id} task={t} projectKey={project.key} draggable={canDrag} onOpen={() => openTask(`${project.key}-${t.number}`)} />
                  ))}
                  {list.length > MAX_PER_DAY ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-[11px] font-medium text-primary hover:underline">
                          +{list.length - MAX_PER_DAY} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 space-y-1 p-2">
                        <p className="text-xs font-semibold">{format(d, "EEEE d MMMM")}</p>
                        {list.map((t) => (
                          <Chip key={t.id} task={t} projectKey={project.key} draggable={false} onOpen={() => openTask(`${project.key}-${t.number}`)} />
                        ))}
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </DayCell>
              );
            })}
          </div>
        </div>
      </DndContext>

      {/* Mobile agenda */}
      <div className="md:hidden">
        {(() => {
          const inMonth = [...byDay.entries()]
            .filter(([iso]) => iso.startsWith(format(month, "yyyy-MM")))
            .sort(([a], [b]) => (a < b ? -1 : 1));
          const msInMonth = milestones.filter((m) => m.due_date?.startsWith(format(month, "yyyy-MM")));
          if (!inMonth.length && !msInMonth.length)
            return <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Tasks with due dates this month appear here." compact />;
          return (
            <ol className="space-y-3">
              {inMonth.map(([iso, list]) => (
                <li key={iso}>
                  <p className={cn("mb-1 text-xs font-semibold", iso === today && "text-primary")}>{format(parseISO(iso), "EEEE d MMMM")}</p>
                  <div className="space-y-1">
                    {list.map((t) => (
                      <Chip key={t.id} task={t} projectKey={project.key} draggable={false} onOpen={() => openTask(`${project.key}-${t.number}`)} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          );
        })()}
      </div>
    </div>
  );
}
