"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/layout/workspace-context";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { ActivityFeed } from "./activity-feed";

/** Workspace-wide activity feed with actor names resolved from co-member profiles. */
export function WorkspaceActivity() {
  const { workspace } = useWorkspace();
  const { data: people } = useQuery({
    queryKey: ["ws-people", workspace.id],
    queryFn: async () => {
      const { data } = await createClient()
        .from("workspace_members")
        .select("user_id, profile:profiles!inner(full_name, avatar_url)")
        .eq("workspace_id", workspace.id);
      return new Map((data ?? []).map((m) => [m.user_id, m.profile]));
    },
  });
  return (
    <ActivityFeed
      scope={{ kind: "workspace", id: workspace.id }}
      queryKey={qk.workspaceActivity(workspace.id)}
      people={people ?? new Map()}
      limit={15}
    />
  );
}
