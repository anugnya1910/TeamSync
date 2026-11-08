"use client";

import { Copy, Link2, LogOut, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeMemberRole, createInvite, leaveWorkspace, removeMember, revokeInvite } from "@/app/(app)/w/[workspaceSlug]/_actions/workspace";
import { UserAvatar } from "@/components/common/visuals";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/domain";
import { shortDate } from "@/lib/utils/format";

export type MemberRow = {
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  profile: { id: string; full_name: string; handle: string; avatar_url: string | null; job_title: string | null };
};
export type InviteRow = {
  id: string;
  role: WorkspaceRole;
  email: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string;
  status: string;
  created_at: string;
};

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState<"member" | "admin" | "guest">("member");
  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(7);
  const [url, setUrl] = useState<string | null>(null);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setUrl(null);
      setEmail("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{url ? "Invite link ready" : "Invite people"}</DialogTitle>
          <DialogDescription>
            {url ? "Share this link — it's shown only once. Anyone with it can join (unless it's email-bound)." : "Create a link to share in chat. Email is optional and restricts who can use it."}
          </DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} aria-label="Invite link" className="font-tabular text-xs" onFocus={(e) => e.target.select()} data-testid="invite-url" />
              <Button
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                  toast.success("Link copied");
                }}
              >
                <Copy className="size-4" aria-hidden /> Copy
              </Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-warning-text">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> For security only a hash is stored — you won&apos;t be able to view this link again.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Role</span>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="guest">Guest (view-only)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Email (optional)</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Anyone with the link" className="h-8" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Max uses</span>
              <Input type="number" min={1} max={1000} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="h-8" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Expires in (days)</span>
              <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8" />
            </label>
          </div>
        )}
        <DialogFooter>
          {url ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await createInvite({ workspaceId: workspace.id, role, email, maxUses, expiresInDays: days });
                  if (!res.ok) {
                    toast.error(res.error.message);
                    return;
                  }
                  setUrl(res.data.url);
                  router.refresh();
                })
              }
            >
              <Link2 className="size-4" aria-hidden /> Create link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersManager({ members, invites }: { members: MemberRow[]; invites: InviteRow[] | null }) {
  const { workspace, role: myRole, user } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const isAdmin = myRole === "owner" || myRole === "admin";

  const act = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error?.message ?? "Something went wrong");
      else {
        toast.success(msg);
        router.refresh();
      }
    });

  const canEditRole = (m: MemberRow) => isAdmin && m.role !== "owner" && (myRole === "owner" || m.role !== "admin" || m.user_id === user.id);

  return (
    <Tabs defaultValue="members">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          {isAdmin ? <TabsTrigger value="invites">Invites ({invites?.filter((i) => i.status === "active").length ?? 0})</TabsTrigger> : null}
        </TabsList>
        <div className="ml-auto flex gap-2">
          {myRole !== "owner" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm(`Leave ${workspace.name}? You'll lose access to its projects.`)) return;
                start(async () => {
                  const res = await leaveWorkspace(workspace.id);
                  if (res && !res.ok) toast.error(res.error.message);
                });
              }}
            >
              <LogOut className="size-4" aria-hidden /> Leave workspace
            </Button>
          ) : null}
          {isAdmin ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Link2 className="size-4" aria-hidden /> Invite people
            </Button>
          ) : null}
        </div>
      </div>

      <TabsContent value="members">
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card" aria-label="Members">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <UserAvatar name={m.profile.full_name} url={m.profile.avatar_url} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.profile.full_name}
                  {m.user_id === user.id ? <Badge variant="secondary" className="ml-2 align-middle">You</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{m.profile.handle}
                  {m.profile.job_title ? ` · ${m.profile.job_title}` : ""} · joined {shortDate(m.joined_at, user.timezone)}
                </p>
              </div>
              {canEditRole(m) ? (
                <Select value={m.role} onValueChange={(v) => act(() => changeMemberRole({ workspaceId: workspace.id, userId: m.user_id, role: v as "member" }), "Role updated")} disabled={pending}>
                  <SelectTrigger className="h-8 w-32" aria-label={`Role for ${m.profile.full_name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={m.role === "owner" ? "default" : "outline"}>{ROLE_LABELS[m.role]}</Badge>
              )}
              {isAdmin && m.role !== "owner" && m.user_id !== user.id && (myRole === "owner" || m.role !== "admin") ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.profile.full_name}`}
                  onClick={() => window.confirm(`Remove ${m.profile.full_name} from ${workspace.name}? Their open tasks will be unassigned.`) && act(() => removeMember({ workspaceId: workspace.id, userId: m.user_id }), "Member removed")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </TabsContent>

      {isAdmin ? (
        <TabsContent value="invites">
          {invites && invites.length ? (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card" aria-label="Invitations">
              {invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const effective = i.status === "active" && expired ? "expired" : i.status === "active" && i.use_count >= i.max_uses ? "exhausted" : i.status;
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <Link2 className="size-4 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{i.email ?? "Open link"} · {ROLE_LABELS[i.role]}</p>
                      <p className="text-xs text-muted-foreground">
                        Used {i.use_count}/{i.max_uses} · expires {shortDate(i.expires_at, user.timezone)} · created {shortDate(i.created_at, user.timezone)}
                      </p>
                    </div>
                    <Badge variant={effective === "active" ? "secondary" : "outline"} className="capitalize">{effective}</Badge>
                    {effective === "active" ? (
                      <Button variant="ghost" size="sm" onClick={() => act(() => revokeInvite(i.id), "Invite revoked")}>Revoke</Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">No invites yet. Create a link with “Invite people”.</p>
          )}
        </TabsContent>
      ) : null}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </Tabs>
  );
}
