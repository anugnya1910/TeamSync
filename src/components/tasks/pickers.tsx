"use client";

import { Check, ChevronsUpDown, Tag, UserPlus } from "lucide-react";
import { useState } from "react";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { StatusIcon } from "@/components/brand/status-icon";
import { ColorDot, UserAvatar } from "@/components/common/visuals";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/domain";
import type { ProjectMember } from "@/lib/data/project";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export const EFFORT_OPTIONS = [1, 2, 3, 5, 8, 13] as const;

export function StatusSelect({
  value,
  onChange,
  disabled,
  id,
  includeCancelled = true,
  className,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
  disabled?: boolean;
  id?: string;
  includeCancelled?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskStatus)} disabled={disabled}>
      <SelectTrigger id={id} className={cn("h-8 w-full", className)} aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.filter((s) => includeCancelled || s !== "cancelled").map((s) => (
          <SelectItem key={s} value={s}>
            <StatusIcon status={s} showLabel />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  onChange,
  disabled,
  id,
  className,
}: {
  value: TaskPriority;
  onChange: (p: TaskPriority) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskPriority)} disabled={disabled}>
      <SelectTrigger id={id} className={cn("h-8 w-full", className)} aria-label="Priority">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            <PriorityIcon priority={p} showLabel />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EffortSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value === null ? "none" : String(value)} onValueChange={(v) => onChange(v === "none" ? null : Number(v))} disabled={disabled}>
      <SelectTrigger id={id} className="h-8 w-full" aria-label="Effort">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No estimate</SelectItem>
        {EFFORT_OPTIONS.map((e) => (
          <SelectItem key={e} value={String(e)}>
            {e} {e === 1 ? "point" : "points"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MilestoneSelect({
  value,
  onChange,
  milestones,
  disabled,
  id,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  milestones: Tables<"milestones">[];
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} className="h-8 w-full" aria-label="Milestone">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No milestone</SelectItem>
        {milestones.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Multi-select of assignable project members (role ≠ viewer, spec §B.8). */
export function AssigneePicker({
  value,
  onChange,
  members,
  disabled,
  id,
  compact,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  members: ProjectMember[];
  disabled?: boolean;
  id?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const assignable = members.filter((m) => m.role !== "viewer");
  const selected = members.filter((m) => value.includes(m.user_id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={`Assignees: ${selected.length ? selected.map((m) => m.profile.full_name).join(", ") : "unassigned"}`}
          disabled={disabled}
          className={cn("h-8 w-full justify-between font-normal", compact && "w-auto")}
        >
          {selected.length ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex -space-x-1.5">
                {selected.slice(0, 3).map((m) => (
                  <UserAvatar key={m.user_id} name={m.profile.full_name} url={m.profile.avatar_url} className="size-5" />
                ))}
              </span>
              <span className="truncate">{selected.length === 1 ? selected[0]!.profile.full_name : `${selected.length} people`}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UserPlus className="size-3.5" aria-hidden /> Unassigned
            </span>
          )}
          <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No assignable members.</CommandEmpty>
            <CommandGroup>
              {assignable.map((m) => {
                const on = value.includes(m.user_id);
                return (
                  <CommandItem
                    key={m.user_id}
                    value={`${m.profile.full_name} ${m.profile.handle}`}
                    onSelect={() => onChange(on ? value.filter((v) => v !== m.user_id) : [...value, m.user_id])}
                  >
                    <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} aria-hidden />
                    <UserAvatar name={m.profile.full_name} url={m.profile.avatar_url} className="size-5" />
                    <span className="truncate">{m.profile.full_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">@{m.profile.handle}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LabelPicker({
  value,
  onChange,
  labels,
  disabled,
  id,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  labels: Tables<"labels">[];
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = labels.filter((l) => value.includes(l.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" size="sm" role="combobox" aria-expanded={open} aria-label={`Labels: ${selected.length ? selected.map((l) => l.name).join(", ") : "none"}`} disabled={disabled} className="h-auto min-h-8 w-full justify-between font-normal">
          {selected.length ? (
            <span className="flex flex-wrap gap-1">
              {selected.map((l) => (
                <LabelChip key={l.id} label={l} />
              ))}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="size-3.5" aria-hidden /> No labels
            </span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search labels…" />
          <CommandList>
            <CommandEmpty>{labels.length ? "No match." : "This project has no labels yet — leads can add them in Settings."}</CommandEmpty>
            <CommandGroup>
              {labels.map((l) => {
                const on = value.includes(l.id);
                return (
                  <CommandItem key={l.id} value={l.name} onSelect={() => onChange(on ? value.filter((v) => v !== l.id) : [...value, l.id])}>
                    <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} aria-hidden />
                    <ColorDot color={l.color} />
                    {l.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LabelChip({ label, className }: { label: Pick<Tables<"labels">, "name" | "color">; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-32 items-center gap-1 rounded-full border bg-card px-1.5 py-0.5 text-[11px] font-medium", className)}>
      <ColorDot color={label.color} className="size-2" />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

export { STATUS_LABELS, PRIORITY_LABELS };
