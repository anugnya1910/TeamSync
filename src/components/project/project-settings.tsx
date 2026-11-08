"use client";

import { Archive, ArchiveRestore, Lock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createLabel,
  createMilestone,
  deleteLabel,
  deleteMilestone,
  deleteProject,
  removeProjectMember,
  setProjectArchived,
  setProjectMember,
  updateMilestone,
  updateProject,
  updateWipLimits,
} from "@/app/(app)/w/[workspaceSlug]/_actions/project";
import { ColorDot, UserAvatar } from "@/components/common/visuals";
import { useWorkspace } from "@/components/layout/workspace-context";
import { SettingsCard } from "@/components/settings/settings-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_ROLE_LABELS, PROJECT_STATUS_LABELS, STATUS_LABELS, type ProjectRole } from "@/lib/domain";
import { COLOR_TOKENS } from "@/lib/validation/phase2";
import { useProject } from "./project-context";

type WsMember = { user_id: string; role: string; profile: { full_name: string; avatar_url: string | null; handle: string } };

function ColorSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-8 w-36" aria-label="Colour">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COLOR_TOKENS.map((c) => (
          <SelectItem key={c} value={c}>
            <ColorDot color={c} /> <span className="capitalize">{c}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProjectSettings({ workspaceMembers }: { workspaceMembers: WsMember[] }) {
  const { project, members, labels, milestones, permissions } = useProject();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState({
    name: project.name,
    description: project.description ?? "",
    icon: project.icon ?? "",
    color: project.color,
    visibility: project.visibility,
    status: project.status,
    startDate: project.start_date ?? "",
    targetDate: project.target_date ?? "",
  });
  const [newLabel, setNewLabel] = useState({ name: "", color: "slate" });
  const [newMs, setNewMs] = useState({ name: "", dueDate: "" });
  const [addUser, setAddUser] = useState("");
  const [wip, setWip] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries((project.wip_limits ?? {}) as Record<string, number>).map(([k, v]) => [k, String(v)])),
  );

  if (!permissions.canEditProject) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-surface-2 p-4 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden /> Only the project lead (or a workspace admin) can change project settings.
      </div>
    );
  }

  const act = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error?.message ?? "Something went wrong");
      else {
        toast.success(success);
        router.refresh();
      }
    });

  const notMembers = workspaceMembers.filter((w) => !members.some((m) => m.user_id === w.user_id));

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(
            () =>
              updateProject({
                projectId: project.id,
                name: d.name,
                description: d.description,
                icon: d.icon,
                color: d.color as (typeof COLOR_TOKENS)[number],
                visibility: d.visibility,
                status: d.status,
                startDate: d.startDate || null,
                targetDate: d.targetDate || null,
              }),
            "Saved",
          );
        }}
      >
        <SettingsCard title="Details" footer={<Button type="submit" disabled={pending}>Save details</Button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} />
            </label>
            <div className="flex gap-3">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Icon / emoji</span>
                <Input value={d.icon} onChange={(e) => setD({ ...d, icon: e.target.value.slice(0, 4) })} className="w-20" />
              </label>
              <div className="space-y-1.5 text-sm">
                <span className="font-medium">Colour</span>
                <ColorSelect value={d.color} onChange={(v) => setD({ ...d, color: v })} />
              </div>
            </div>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Description (markdown)</span>
              <Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={10000} />
            </label>
            <div className="space-y-1.5 text-sm">
              <span className="font-medium">Status</span>
              <Select value={d.status} onValueChange={(v) => setD({ ...d, status: v as typeof d.status })}>
                <SelectTrigger className="h-8" aria-label="Project status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["planning", "active", "on_hold", "completed"] as const).map((s) => (
                    <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>
                  ))}
                  {d.status === "archived" ? <SelectItem value="archived">Archived</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 text-sm">
              <span className="font-medium">Visibility</span>
              <Select value={d.visibility} onValueChange={(v) => setD({ ...d, visibility: v as typeof d.visibility })}>
                <SelectTrigger className="h-8" aria-label="Visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">Workspace — all members can view</SelectItem>
                  <SelectItem value="private">Private — project members only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Start date</span>
              <Input type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Target date</span>
              <Input type="date" value={d.targetDate} min={d.startDate || undefined} onChange={(e) => setD({ ...d, targetDate: e.target.value })} />
            </label>
          </div>
        </SettingsCard>
      </form>

      <SettingsCard title="Members & capacity" description="Capacity is story points per week — used by Workload Balance (Phase 3).">
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2">
              <UserAvatar name={m.profile.full_name} url={m.profile.avatar_url} className="size-7" />
              <span className="min-w-0 flex-1 truncate text-sm">{m.profile.full_name}</span>
              <Select value={m.role} onValueChange={(v) => act(() => setProjectMember({ projectId: project.id, userId: m.user_id, role: v as ProjectRole, capacity: m.weekly_capacity_points }), "Role updated")}>
                <SelectTrigger className="h-8 w-32" aria-label={`Role for ${m.profile.full_name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["lead", "contributor", "viewer"] as const).map((r) => <SelectItem key={r} value={r}>{PROJECT_ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                max={200}
                defaultValue={m.weekly_capacity_points}
                aria-label={`Weekly capacity for ${m.profile.full_name}`}
                className="h-8 w-20"
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isInteger(v) && v >= 0 && v <= 200 && v !== m.weekly_capacity_points)
                    act(() => setProjectMember({ projectId: project.id, userId: m.user_id, role: m.role, capacity: v }), "Capacity updated");
                }}
              />
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.profile.full_name}`} onClick={() => window.confirm(`Remove ${m.profile.full_name} from this project? Their open tasks will be unassigned.`) && act(() => removeProjectMember({ projectId: project.id, userId: m.user_id }), "Member removed")}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {notMembers.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Select value={addUser} onValueChange={setAddUser}>
              <SelectTrigger className="h-8 w-56" aria-label="Workspace member to add"><SelectValue placeholder="Add a workspace member…" /></SelectTrigger>
              <SelectContent>
                {notMembers.map((w) => <SelectItem key={w.user_id} value={w.user_id}>{w.profile.full_name}{w.role === "guest" ? " (guest · viewer)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!addUser || pending} onClick={() => { act(() => setProjectMember({ projectId: project.id, userId: addUser, role: "contributor", capacity: 20 }), "Member added"); setAddUser(""); }}>
              <Plus className="size-3.5" aria-hidden /> Add
            </Button>
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard title="Milestones">
        <ul className="divide-y">
          {milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
              <Input type="date" defaultValue={m.due_date ?? ""} aria-label={`Due date for ${m.name}`} className="h-8 w-40" onBlur={(e) => e.target.value !== (m.due_date ?? "") && act(() => updateMilestone({ milestoneId: m.id, name: m.name, description: m.description ?? "", dueDate: e.target.value || null, status: m.status }), "Milestone updated")} />
              <Button variant="outline" size="sm" onClick={() => act(() => updateMilestone({ milestoneId: m.id, name: m.name, description: m.description ?? "", dueDate: m.due_date, status: m.status === "open" ? "completed" : "open" }), "Milestone updated")}>
                {m.status === "open" ? "Mark complete" : "Reopen"}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete milestone ${m.name}`} onClick={() => window.confirm(`Delete milestone "${m.name}"? Its tasks are kept.`) && act(() => deleteMilestone(m.id), "Milestone deleted")}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!newMs.name.trim()) return; act(() => createMilestone({ projectId: project.id, name: newMs.name, dueDate: newMs.dueDate || null }), "Milestone added"); setNewMs({ name: "", dueDate: "" }); }}>
          <Input value={newMs.name} onChange={(e) => setNewMs({ ...newMs, name: e.target.value })} placeholder="New milestone name" aria-label="New milestone name" className="h-8 flex-1" maxLength={80} />
          <Input type="date" value={newMs.dueDate} onChange={(e) => setNewMs({ ...newMs, dueDate: e.target.value })} aria-label="New milestone due date" className="h-8 w-40" />
          <Button type="submit" size="sm" disabled={!newMs.name.trim()}><Plus className="size-3.5" aria-hidden /> Add</Button>
        </form>
      </SettingsCard>

      <SettingsCard title="Labels">
        <ul className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2 text-sm">
              <ColorDot color={l.color} /> {l.name}
              <Button variant="ghost" size="icon-xs" aria-label={`Delete label ${l.name}`} onClick={() => act(() => deleteLabel(l.id), "Label deleted")}>
                <Trash2 className="size-3" aria-hidden />
              </Button>
            </li>
          ))}
          {labels.length === 0 ? <li className="text-sm text-muted-foreground">No labels yet.</li> : null}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!newLabel.name.trim()) return; act(() => createLabel({ projectId: project.id, name: newLabel.name, color: newLabel.color as (typeof COLOR_TOKENS)[number] }), "Label added"); setNewLabel({ name: "", color: "slate" }); }}>
          <Input value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="Label name" aria-label="New label name" className="h-8 flex-1" maxLength={30} />
          <ColorSelect value={newLabel.color} onChange={(v) => setNewLabel({ ...newLabel, color: v })} />
          <Button type="submit" size="sm" disabled={!newLabel.name.trim()}><Plus className="size-3.5" aria-hidden /> Add</Button>
        </form>
      </SettingsCard>

      <SettingsCard
        title="WIP limits"
        description="Columns over their limit are outlined on the board (visual warning only)."
        footer={
          <Button
            onClick={() =>
              act(
                () =>
                  updateWipLimits({
                    projectId: project.id,
                    limits: Object.fromEntries(Object.entries(wip).map(([k, v]) => [k, v ? Number(v) : null])),
                  }),
                "WIP limits saved",
              )
            }
          >
            Save limits
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-5">
          {(["backlog", "todo", "in_progress", "in_review", "done"] as const).map((s) => (
            <label key={s} className="space-y-1 text-sm">
              <span className="text-xs font-medium">{STATUS_LABELS[s]}</span>
              <Input type="number" min={1} max={500} value={wip[s] ?? ""} placeholder="No limit" onChange={(e) => setWip({ ...wip, [s]: e.target.value })} className="h-8" />
            </label>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Danger zone" tone="danger">
        <div className="flex flex-wrap gap-2">
          {project.status === "archived" ? (
            <Button variant="outline" onClick={() => act(() => setProjectArchived({ projectId: project.id, archived: false }), "Project restored")}>
              <ArchiveRestore className="size-4" aria-hidden /> Restore from archive
            </Button>
          ) : (
            <Button variant="outline" onClick={() => window.confirm("Archive this project? It becomes read-only and hidden from default lists.") && act(() => setProjectArchived({ projectId: project.id, archived: true }), "Project archived")}>
              <Archive className="size-4" aria-hidden /> Archive project
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              const typed = window.prompt(`Type ${project.key} to delete this project. A lead can restore it within 30 days.`);
              if (typed !== project.key) return;
              start(async () => {
                const res = await deleteProject(project.id);
                if (!res.ok) {
                  toast.error(res.error.message);
                  return;
                }
                toast.success("Project deleted");
                router.push(`/w/${workspace.slug}/projects`);
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete project
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
