"use client";

import { Check, Plus, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTeam, deleteTeam, setTeamMembers, updateTeam } from "@/app/(app)/w/[workspaceSlug]/_actions/workspace";
import { EmptyState } from "@/components/brand/empty-state";
import { AvatarStack, ColorDot, ProjectIcon, tokenColor, UserAvatar } from "@/components/common/visuals";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { COLOR_TOKENS } from "@/lib/validation/phase2";
import { cn } from "@/lib/utils";

export type TeamCard = {
  id: string;
  name: string;
  color: string;
  icon: string;
  members: { user_id: string; full_name: string; avatar_url: string | null }[];
  projectCount: number;
};

function TeamDialog({ open, onOpenChange, team }: { open: boolean; onOpenChange: (o: boolean) => void; team?: TeamCard }) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState<(typeof COLOR_TOKENS)[number]>((team?.color as "indigo") ?? "indigo");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = team
                ? await updateTeam({ teamId: team.id, name, color, icon: "users" })
                : await createTeam({ workspaceId: workspace.id, name, color, icon: "users" });
              if (!res.ok) {
                toast.error(res.error.message);
                return;
              }
              toast.success(team ? "Team updated" : "Team created");
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{team ? "Edit team" : "New team"}</DialogTitle>
            <DialogDescription>Teams let you add a group of people to a project in one go.</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="e.g. Frontend" />
          </label>
          <div className="space-y-1.5">
            <span className="text-sm font-medium" id="team-color">Colour</span>
            <div className="flex gap-1" role="radiogroup" aria-labelledby="team-color">
              {COLOR_TOKENS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={cn("grid size-8 place-items-center rounded-md border", color === c && "border-primary ring-2 ring-primary/30")}>
                  <ColorDot color={c} className="size-4" />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !name.trim()}>{team ? "Save" : "Create team"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamsView({ teams }: { teams: TeamCard[] }) {
  const { workspace, role } = useWorkspace();
  const [open, setOpen] = useState(false);
  const isAdmin = role === "owner" || role === "admin";
  return (
    <div>
      {isAdmin ? (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden /> New team</Button>
        </div>
      ) : null}
      {teams.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={UsersRound} title="No teams yet" description={isAdmin ? "Create a team to group members (e.g. Frontend, Design) and add them to projects together." : "Owners and admins can create teams."} />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <li key={t.id}>
              <Link href={`/w/${workspace.slug}/teams/${t.id}`} className="block overflow-hidden rounded-2xl border bg-card hover:shadow-[var(--shadow-e2)]">
                <span aria-hidden className="block h-1" style={{ background: tokenColor(t.color) }} />
                <span className="block space-y-3 p-4">
                  <span className="flex items-center gap-2">
                    <ProjectIcon icon={null} color={t.color} name={t.name} className="size-8 text-sm" />
                    <span className="font-semibold">{t.name}</span>
                  </span>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    <AvatarStack people={t.members.map((m) => ({ id: m.user_id, name: m.full_name, url: m.avatar_url }))} max={5} />
                    <span>{t.members.length} members · {t.projectCount} projects</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TeamDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function TeamDetail({
  team,
  workspaceMembers,
  projects,
}: {
  team: TeamCard;
  workspaceMembers: { user_id: string; full_name: string; avatar_url: string | null }[];
  projects: { id: string; key: string; name: string; color: string; icon: string | null }[];
}) {
  const { workspace, role } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(team.members.map((m) => m.user_id)));
  const isAdmin = role === "owner" || role === "admin";
  const dirty = selected.size !== team.members.length || team.members.some((m) => !selected.has(m.user_id));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="tm-h" className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="tm-h" className="text-card-title">Members</h2>
          {isAdmin ? (
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit team</Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!window.confirm(`Delete team ${team.name}? Projects and people are not affected.`)) return;
                  start(async () => {
                    const res = await deleteTeam(team.id);
                    if (!res.ok) {
                      toast.error(res.error.message);
                      return;
                    }
                    router.push(`/w/${workspace.slug}/teams`);
                  });
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            </div>
          ) : null}
        </div>
        {isAdmin ? (
          <>
            <ul className="divide-y" aria-label="Choose team members">
              {workspaceMembers.map((m) => {
                const on = selected.has(m.user_id);
                return (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(m.user_id)) n.delete(m.user_id);
                          else n.add(m.user_id);
                          return n;
                        })
                      }
                      className="flex w-full items-center gap-3 py-2 text-left text-sm"
                    >
                      <span className={cn("grid size-5 place-items-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>{on ? <Check className="size-3.5" aria-hidden /> : null}</span>
                      <UserAvatar name={m.full_name} url={m.avatar_url} className="size-7" />
                      {m.full_name}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex justify-end">
              <Button
                disabled={!dirty || pending}
                onClick={() =>
                  start(async () => {
                    const res = await setTeamMembers({ teamId: team.id, userIds: [...selected] });
                    if (!res.ok) {
                      toast.error(res.error.message);
                      return;
                    }
                    toast.success("Team members saved");
                    router.refresh();
                  })
                }
              >
                Save members
              </Button>
            </div>
          </>
        ) : team.members.length ? (
          <ul className="space-y-2">
            {team.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 text-sm"><UserAvatar name={m.full_name} url={m.avatar_url} className="size-7" /> {m.full_name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        )}
      </section>
      <section aria-labelledby="tp-h" className="rounded-2xl border bg-card p-5">
        <h2 id="tp-h" className="text-card-title mb-3">Projects</h2>
        {projects.length ? (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/w/${workspace.slug}/p/${p.key}`} className="flex items-center gap-2 text-sm hover:underline">
                  <ProjectIcon icon={p.icon} color={p.color} name={p.name} className="size-6 text-xs" /> {p.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No projects use this team yet. Pick it when creating a project to add everyone at once.</p>
        )}
      </section>
      <TeamDialog open={editOpen} onOpenChange={setEditOpen} team={team} />
    </div>
  );
}
