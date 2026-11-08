"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotifications } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { qk } from "@/lib/query-keys";
import { NotificationItem } from "./notification-item";
import { useNotificationList, useNotificationsRealtime, useUnreadCount } from "./use-notifications";

export function NotificationBell() {
  const { user, workspace } = useWorkspace();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useNotificationsRealtime(user.id);
  const { data: unread = 0 } = useUnreadCount(user.id, workspace.id);
  const { data: items = [], isPending } = useNotificationList(user.id, workspace.id, { limit: 10 });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.unreadCount(user.id) });
    void qc.invalidateQueries({ queryKey: qk.notifications(user.id) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications (${unread} unread)` : "Notifications (0 unread)"} data-testid="notification-bell">
          <Bell className="size-4" aria-hidden />
          {unread ? (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-tabular text-[10px] font-bold text-accent-foreground" data-testid="unread-badge">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="xs"
            disabled={!unread}
            onClick={async () => {
              const res = await markAllNotificationsRead(workspace.id);
              if (!res.ok) toast.error(res.error.message);
              refresh();
            }}
          >
            <CheckCheck className="size-3.5" aria-hidden /> Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {isPending ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            items.map((n) => (
              <NotificationItem
                key={n.id}
                n={n}
                onSelect={async () => {
                  if (!n.read_at) {
                    await markNotifications({ ids: [n.id], read: true });
                    refresh();
                  }
                  setOpen(false);
                  if (n.link) router.push(n.link);
                }}
              />
            ))
          )}
        </div>
        <div className="border-t p-1.5">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            <Link href={`/w/${workspace.slug}/inbox`}>Open inbox</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
