"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Per-user realtime channel `user:{uid}` for notifications (spec §C.6). */
export function useNotificationsRealtime(userId: string) {
  const qc = useQueryClient();
  const { trigger } = useSyncLine();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`user:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        void qc.invalidateQueries({ queryKey: qk.unreadCount(userId) });
        void qc.invalidateQueries({ queryKey: qk.notifications(userId) });
        if (payload.eventType === "INSERT") trigger();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc, trigger]);
}
