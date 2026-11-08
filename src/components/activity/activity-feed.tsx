"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { UserAvatar } from "@/components/common/visuals";
import { Button } from "@/components/ui/button";
import { boldSegments, describeActivity, type ActivityLog } from "@/lib/activity";
import { createClient } from "@/lib/supabase/client";

const PAGE = 30;

type Scope = { kind: "task"; id: string } | { kind: "project"; id: string } | { kind: "workspace"; id: string };

/** Cursor-paginated activity feed (created_at,id desc; 30 per page) — spec §B.15. */
export function ActivityFeed({
  scope,
  queryKey,
  people,
  compact,
  limit,
}: {
  scope: Scope;
  queryKey: readonly unknown[];
  people: Map<string, { full_name: string; avatar_url: string | null }>;
  compact?: boolean;
  limit?: number;
}) {
  const pageSize = limit ?? PAGE;
  const q = useInfiniteQuery({
    queryKey,
    initialPageParam: null as { created_at: string; id: number } | null,
    queryFn: async ({ pageParam }) => {
      let query = createClient()
        .from("activity_logs")
        .select("id, action, actor_id, metadata, created_at, task_id, project_id")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize);
      if (scope.kind === "task") query = query.eq("task_id", scope.id);
      else if (scope.kind === "project") query = query.eq("project_id", scope.id);
      else query = query.eq("workspace_id", scope.id);
      if (pageParam) query = query.or(`created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
    getNextPageParam: (last) =>
      !limit && last.length === pageSize ? { created_at: last[last.length - 1]!.created_at, id: last[last.length - 1]!.id } : null,
  });

  const rows = q.data?.pages.flat() ?? [];
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (q.isError) return <p className="text-sm text-danger-text">Couldn&apos;t load activity.</p>;
  if (!rows.length) return <EmptyState icon={History} title="No activity yet" description="Changes to tasks, comments and members appear here." compact as="h3" />;

  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-label="Activity">
        {rows.map((r) => {
          const actor = r.actor_id ? people.get(r.actor_id) : undefined;
          const name = actor?.full_name ?? "Someone";
          return (
            <li key={r.id} className="flex gap-2.5 text-sm">
              {!compact ? <UserAvatar name={name} url={actor?.avatar_url} className="size-6" /> : null}
              <div className="min-w-0">
                <p className="text-foreground/90">
                  {boldSegments(describeActivity(r, name)).map((s, i) =>
                    s.bold ? (
                      <strong key={i} className="font-tabular font-semibold">
                        {s.text}
                      </strong>
                    ) : (
                      <span key={i}>{s.text}</span>
                    ),
                  )}
                </p>
                <time className="text-xs text-muted-foreground" dateTime={r.created_at} title={new Date(r.created_at).toLocaleString()}>
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      {q.hasNextPage ? (
        <Button variant="outline" size="sm" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
