"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck, ExternalLink, Mail, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotifications } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { EmptyState } from "@/components/brand/empty-state";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { NOTIFICATION_META, NotificationItem } from "./notification-item";
import { useNotificationList, useNotificationsRealtime, type NotificationRow } from "./use-notifications";

export function Inbox() {
  const { user, workspace } = useWorkspace();
  const qc = useQueryClient();
  const router = useRouter();
  const [type, setType] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  useNotificationsRealtime(user.id);
  const { data: items = [], isPending } = useNotificationList(user.id, workspace.id, { limit: 100, unreadOnly, type });
  const active = items.find((n) => n.id === activeId) ?? null;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.notifications(user.id) });
    void qc.invalidateQueries({ queryKey: qk.unreadCount(user.id) });
  };
  const setRead = async (n: NotificationRow, read: boolean) => {
    const res = await markNotifications({ ids: [n.id], read });
    if (!res.ok) toast.error(res.error.message);
    refresh();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Inbox filters">
        <Select value={type ?? "all"} onValueChange={(v) => setType(v === "all" ? null : v)}>
          <SelectTrigger className="h-8 w-56" aria-label="Notification type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(NOTIFICATION_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} aria-label="Unread only" /> Unread only
        </label>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={async () => {
            const res = await markAllNotificationsRead(workspace.id);
            if (!res.ok) toast.error(res.error.message);
            else toast.success(`Marked ${res.data.count} as read`);
            refresh();
          }}
        >
          <CheckCheck className="size-4" aria-hidden /> Mark all read
        </Button>
      </div>

      {isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" role="status" aria-label="Loading notifications" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={BellOff} title="You're all caught up" description="Assignments, mentions, comments and due dates will show up here." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ul className={cn("space-y-0.5 rounded-2xl border bg-card p-1.5", active && "hidden md:block")} aria-label="Notifications">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  n={n}
                  active={n.id === activeId}
                  onSelect={() => {
                    setActiveId(n.id);
                    if (!n.read_at) void setRead(n, true);
                  }}
                />
              </li>
            ))}
          </ul>
          <section aria-label="Notification preview" className={cn("rounded-2xl border bg-card p-5", !active && "hidden md:block")}>
            {active ? (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setActiveId(null)}>← Back</Button>
                <p className="text-xs text-muted-foreground">{NOTIFICATION_META[active.type]?.label} · {new Date(active.created_at).toLocaleString()}</p>
                <h2 className="text-section">{active.title}</h2>
                {active.body ? <p className="text-sm whitespace-pre-wrap text-muted-foreground">{active.body}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {active.link ? (
                    <Button onClick={() => router.push(active.link!)}>
                      <ExternalLink className="size-4" aria-hidden /> Open task
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => void setRead(active, !active.read_at)}>
                    {active.read_at ? <><Mail className="size-4" aria-hidden /> Mark unread</> : <><MailOpen className="size-4" aria-hidden /> Mark read</>}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a notification to see details.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
