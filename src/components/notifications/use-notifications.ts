"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useSyncLine } from "@/components/brand/sync-line";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

export type NotificationRow = Tables<"notifications">;

export function useUnreadCount(userId: string, workspaceId: string) {
  return useQuery({
    queryKey: [...qk.unreadCount(userId), workspaceId],
    queryFn: async () => {
      const { count, error } = await createClient()
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useNotificationList(userId: string, workspaceId: string, opts: { limit?: number; unreadOnly?: boolean; type?: string | null } = {}) {
  return useQuery({
    queryKey: [...qk.notifications(userId), workspaceId, opts],
    queryFn: async () => {
      let q = createClient()
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(opts.limit ?? 50);
      if (opts.unreadOnly) q = q.is("read_at", null);
      if (opts.type) q = q.eq("type", opts.type as NotificationRow["type"]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

type NotificationEvent = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Partial<NotificationRow> };
type Listener = (e: NotificationEvent) => void;
const userListeners = new Map<string, Set<Listener>>();
const userChannels = new Map<string, RealtimeChannel>();

/**
 * One shared `user:{uid}` channel per user, ref-counted. realtime-js reuses channels by topic and
 * throws when callbacks are added after subscribe(), so the bell, inbox and achievement toasts
 * must share a single subscription rather than each calling `.channel().on()`.
 */
export function subscribeToMyNotifications(userId: string, fn: Listener): () => void {
  let set = userListeners.get(userId);
  if (!set) userListeners.set(userId, (set = new Set()));
  set.add(fn);
  if (!userChannels.has(userId)) {
    const supabase = createClient();
    const channel = supabase
      .channel(`user:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const e = { eventType: payload.eventType, new: payload.new as Partial<NotificationRow> } as NotificationEvent;
        for (const l of userListeners.get(userId) ?? []) l(e);
      })
      .subscribe();
    userChannels.set(userId, channel);
  }
  return () => {
    const cur = userListeners.get(userId);
    cur?.delete(fn);
    if (cur && cur.size === 0) {
      userListeners.delete(userId);
      const ch = userChannels.get(userId);
      userChannels.delete(userId);
      if (ch) void createClient().removeChannel(ch);
    }
  };
}

/** Keeps notification queries fresh from the shared per-user channel (spec §C.6). */
export function useNotificationsRealtime(userId: string) {
  const qc = useQueryClient();
  const { trigger } = useSyncLine();
  useEffect(
    () =>
      subscribeToMyNotifications(userId, (e) => {
        void qc.invalidateQueries({ queryKey: qk.unreadCount(userId) });
        void qc.invalidateQueries({ queryKey: qk.notifications(userId) });
        if (e.eventType === "INSERT") trigger();
      }),
    [userId, qc, trigger],
  );
}
