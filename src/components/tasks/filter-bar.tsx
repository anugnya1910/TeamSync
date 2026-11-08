"use client";

import { Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { StatusIcon } from "@/components/brand/status-icon";
import { ColorDot } from "@/components/common/visuals";
import { useProject } from "@/components/project/project-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { activeFilterCount, EMPTY_FILTERS, parseFilters, serializeFilters, type TaskFilters } from "@/lib/filters";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain";

export function useTaskFilters(): [TaskFilters, (f: TaskFilters) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const set = (f: TaskFilters) => {
    const qs = serializeFilters(f, new URLSearchParams(params.toString())).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [filters, set];
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Shared filter bar for Board / List / Calendar — state lives in the URL (spec §B.17). */
export function FilterBar({ children }: { children?: React.ReactNode }) {
  const [filters, setFilters] = useTaskFilters();
  const { members, labels, milestones } = useProject();
  const [q, setQ] = useState(filters.q);
  const count = activeFilterCount(filters);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Task filters">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => q !== filters.q && setFilters({ ...filters, q })}
        onKeyDown={(e) => e.key === "Enter" && setFilters({ ...filters, q })}
        placeholder="Filter by text or key…"
        aria-label="Filter by text"
        className="h-8 w-full sm:w-52"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="size-3.5" aria-hidden /> Filters
            {count ? (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]" aria-label={`${count} active`}>
                {count}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-60 overflow-y-auto">
          <DropdownMenuLabel>Assignee</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={filters.assignee.includes("me")} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, assignee: toggle(filters.assignee, "me") })}>
            Me
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={filters.assignee.includes("unassigned")} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, assignee: toggle(filters.assignee, "unassigned") })}>
            Unassigned
          </DropdownMenuCheckboxItem>
          {members.map((m) => (
            <DropdownMenuCheckboxItem key={m.user_id} checked={filters.assignee.includes(m.user_id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, assignee: toggle(filters.assignee, m.user_id) })}>
              {m.profile.full_name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {TASK_STATUSES.map((s) => (
            <DropdownMenuCheckboxItem key={s} checked={filters.status.includes(s)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, status: toggle(filters.status, s) })}>
              <StatusIcon status={s} /> {STATUS_LABELS[s]}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          {TASK_PRIORITIES.map((p) => (
            <DropdownMenuCheckboxItem key={p} checked={filters.priority.includes(p)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, priority: toggle(filters.priority, p) })}>
              <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
            </DropdownMenuCheckboxItem>
          ))}
          {labels.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Labels</DropdownMenuLabel>
              {labels.map((l) => (
                <DropdownMenuCheckboxItem key={l.id} checked={filters.label.includes(l.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, label: toggle(filters.label, l.id) })}>
                  <ColorDot color={l.color} /> {l.name}
                </DropdownMenuCheckboxItem>
              ))}
            </>
          ) : null}
          {milestones.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Milestone</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filters.milestone.includes("none")} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, milestone: toggle(filters.milestone, "none") })}>
                No milestone
              </DropdownMenuCheckboxItem>
              {milestones.map((m) => (
                <DropdownMenuCheckboxItem key={m.id} checked={filters.milestone.includes(m.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setFilters({ ...filters, milestone: toggle(filters.milestone, m.id) })}>
                  {m.name}
                </DropdownMenuCheckboxItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Due</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={filters.due ?? "any"} onValueChange={(v) => setFilters({ ...filters, due: v === "any" ? null : (v as TaskFilters["due"]) })}>
            {[
              ["any", "Any time"],
              ["overdue", "Overdue"],
              ["today", "Due today"],
              ["week", "This week"],
              ["none", "No date"],
            ].map(([v, l]) => (
              <DropdownMenuRadioItem key={v} value={v!} onSelect={(e) => e.preventDefault()}>
                {l}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={filters.blocked === true} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => setFilters({ ...filters, blocked: v ? true : null })}>
            Blocked only
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {count ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            setQ("");
            setFilters(EMPTY_FILTERS);
          }}
        >
          <X className="size-3.5" aria-hidden /> Clear all
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
