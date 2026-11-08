"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useSyncLine } from "@/components/brand/sync-line";
import { createClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query-keys";
import { pendingMutationIds } from "./use-project-tasks";

export type PresenceUser = { userId: string; name: string; avatarUrl: string | null; view: string };
export type ChannelState = "connecting" | "live" | "reconnecting";

/**
 * Project realtime (spec §B.9, §C.6): postgres_changes on tasks / assignees / comments filtered by
 * project_id (RLS applies to events) + presence. Merges by invalidating the TanStack cache,
 * sweeps the Sync Line, reconnects with exponential backoff, unsubscribes on unmount.
 */
export function useProjectRealtime(projectId: string, me: Omit<PresenceUser, "view">, view: string) {
  const qc = useQueryClient();
  const { trigger } = useSyncLine();
  const [state, setState] = useState<ChannelState>("connecting");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const meRef = useRef(me);
  const viewRef = useRef(view);
  useEffect(() => {
    meRef.current = me;
    viewRef.current = view;
  });

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let attempt = 0;
    let retryTimer: number | undefined;
    let debounce: number | undefined;
    let disposed = false;

    const refresh = (taskId?: string) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
        void qc.invalidateQueries({ queryKey: qk.projectActivity(projectId) });
        if (taskId) {
          void qc.invalidateQueries({ queryKey: qk.task(taskId) });
          void qc.invalidateQueries({ queryKey: qk.taskComments(taskId) });
          void qc.invalidateQueries({ queryKey: qk.taskActivity(taskId) });
        }
      }, 120);
    };

    const subscribe = () => {
      if (disposed) return;
      channel = supabase.channel(`project:${projectId}`, { config: { presence: { key: meRef.current.userId } } });
      const filter = `project_id=eq.${projectId}`;
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          refresh(row?.id);
          trigger();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees", filter }, (payload) => {
          const row = (payload.new ?? payload.old) as { task_id?: string } | null;
          refresh(row?.task_id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter }, (payload) => {
          const row = (payload.new ?? payload.old) as { task_id?: string } | null;
          refresh(row?.task_id);
          trigger();
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter }, (payload) => {
          // Ignore echoes of our own optimistic mutations (they're already in the cache).
          const meta = (payload.new as { metadata?: { client_mutation_id?: string } }).metadata;
          if (meta?.client_mutation_id && pendingMutationIds.has(meta.client_mutation_id)) return;
          void qc.invalidateQueries({ queryKey: qk.projectActivity(projectId) });
        })
        .on("presence", { event: "sync" }, () => {
          const s = channel?.presenceState<PresenceUser>() ?? {};
          const users = Object.values(s)
            .map((arr) => arr[0])
            .filter((u): u is PresenceUser & { presence_ref: string } => Boolean(u));
          setPresence(users.map(({ userId, name, avatarUrl, view }) => ({ userId, name, avatarUrl, view })));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            attempt = 0;
            setState("live");
            void channel?.track({ ...meRef.current, view: viewRef.current });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (disposed) return;
            setState("reconnecting");
            const ch = channel;
            channel = null;
            if (ch) void supabase.removeChannel(ch);
            const delay = Math.min(30_000, 1000 * 2 ** attempt++);
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(subscribe, delay);
          }
        });
    };

    subscribe();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(debounce);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId, qc, trigger]);

  // Update presence view when the user switches tabs within the project.
  useEffect(() => {
    // tracked on next subscribe; cheap re-track when connected
    if (state !== "live") return;
    const supabase = createClient();
    const ch = supabase.getChannels().find((c) => c.topic === `realtime:project:${projectId}`);
    void ch?.track({ ...meRef.current, view });
  }, [view, state, projectId]);

  return { state, presence };
}
