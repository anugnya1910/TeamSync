"use client";

import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useQueryClient } from "@tanstack/react-query";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { GitBranch, List, Network } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/empty-state";
import { StatusIcon } from "@/components/brand/status-icon";
import { useProject } from "@/components/project/project-context";
import { useOpenTask } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { depsKey, openBlockersOf, useProjectDeps } from "@/hooks/use-project-deps";
import { useProjectTasks, type BoardTask } from "@/hooks/use-project-tasks";
import { findPath, longestOpenChain, wouldCreateCycle } from "@/lib/algorithms/dependencies";
import type { TaskLite } from "@/lib/algorithms/types";
import { mapPgError } from "@/lib/action-result";
import { clientInsert } from "@/lib/db-insert";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NODE_W = 220;
const NODE_H = 64;
const MAX_CANVAS_NODES = 300;

type NodeData = { task: BoardTask; projectKey: string; blocked: boolean; onChain: boolean };

function TaskNode({ data }: NodeProps<Node<NodeData>>) {
  const t = data.task;
  return (
    <div
      className={cn(
        "w-[220px] rounded-lg border bg-card px-2.5 py-2 text-left text-xs shadow-[var(--shadow-e1)]",
        data.blocked && "border-2 border-danger",
        data.onChain && !data.blocked && "border-accent",
        t.status === "done" && "opacity-70",
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5">
        <StatusIcon status={t.status} />
        <span className="font-tabular text-muted-foreground">{data.projectKey}-{t.number}</span>
        {t.due_date ? <span className="ml-auto text-muted-foreground">{t.due_date.slice(5)}</span> : null}
      </div>
      <p className="mt-0.5 truncate font-medium">{t.title}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { task: TaskNode };

function layout(nodes: Node<NodeData>[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

const mq = "(min-width: 768px)";
function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(mq);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(mq).matches,
    () => true,
  );
}

const toLite = (t: BoardTask): TaskLite => ({
  id: t.id, parentTaskId: t.parent_task_id, status: t.status, priority: t.priority, effort: t.effort_points,
  dueDate: t.due_date, isBlocked: t.is_blocked, assigneeIds: t.assigneeIds, milestoneId: t.milestone_id,
});

export function DependencyMap() {
  const { project, milestones, members, permissions } = useProject();
  const qc = useQueryClient();
  const openTask = useOpenTask();
  const desktop = useDesktop();
  const { data: tasks = [], isPending } = useProjectTasks(project.id);
  const { data: deps = [] } = useProjectDeps(project.id);
  const [view, setView] = useState<"auto" | "map" | "tree">("auto");
  const [milestone, setMilestone] = useState("all");
  const [assignee, setAssignee] = useState("all");

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const statusById = useMemo(() => new Map(tasks.map((t) => [t.id, t.status as string])), [tasks]);
  const linked = useMemo(() => {
    const ids = new Set<string>();
    for (const d of deps) {
      ids.add(d.blockerId);
      ids.add(d.blockedId);
    }
    return tasks.filter(
      (t) => ids.has(t.id) && (milestone === "all" || t.milestone_id === milestone) && (assignee === "all" || t.assigneeIds.includes(assignee)),
    );
  }, [tasks, deps, milestone, assignee]);
  const visibleIds = new Set(linked.map((t) => t.id));
  const visibleDeps = deps.filter((d) => visibleIds.has(d.blockerId) && visibleIds.has(d.blockedId));
  const chain = useMemo(() => longestOpenChain(tasks.map(toLite), deps), [tasks, deps]);
  const chainEdges = new Set(chain.taskIds.slice(1).map((id, i) => `${chain.taskIds[i]}->${id}`));
  const chainNodes = new Set(chain.length >= 2 ? chain.taskIds : []);

  const chainKey = chain.taskIds.join();
  const mode = view === "auto" ? (!desktop || linked.length > MAX_CANVAS_NODES ? "tree" : "map") : view;

  const { nodes, edges } = useMemo(() => {
    const ns: Node<NodeData>[] = linked.map((t) => ({
      id: t.id,
      type: "task",
      position: { x: 0, y: 0 },
      data: { task: t, projectKey: project.key, blocked: t.is_blocked || openBlockersOf(t.id, deps, statusById).length > 0, onChain: chainNodes.has(t.id) },
    }));
    const es: Edge[] = visibleDeps.map((d) => {
      const onChain = chainEdges.has(`${d.blockerId}->${d.blockedId}`);
      return {
        id: d.id,
        source: d.blockerId,
        target: d.blockedId,
        animated: byId.get(d.blockerId)?.status === "in_progress",
        style: onChain ? { stroke: "var(--accent)", strokeWidth: 3.5 } : { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
      };
    });
    return { nodes: layout(ns, es), edges: es };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, visibleDeps.length, deps, chainKey]);

  const connect = async (c: Connection) => {
    if (!permissions.canEditTasks || !c.source || !c.target) return;
    if (wouldCreateCycle(deps, c.source, c.target)) {
      const path = findPath(deps, c.target, c.source) ?? [c.target, c.source];
      toast.error(`This would create a loop: ${[...path, c.target].map((id) => `${project.key}-${byId.get(id)?.number}`).join(" → ")}`);
      return;
    }
    const { error } = await createClient().from("task_dependencies").insert(clientInsert("task_dependencies", { blocker_task_id: c.source, blocked_task_id: c.target }));
    if (error) return toast.error(mapPgError(error).message);
    void qc.invalidateQueries({ queryKey: depsKey(project.id) });
  };

  if (isPending) return <div className="h-96 animate-pulse rounded-2xl bg-surface-2" role="status" aria-label="Loading dependency map" />;

  if (deps.length === 0) {
    return (
      <div className="rounded-2xl border bg-card">
        <EmptyState icon={GitBranch} title="No dependencies" description="Link tasks from a task's “Blocked by / Blocking” section, or drag between nodes here once some exist." />
      </div>
    );
  }

  // Indented blocked-by tree: roots are tasks that block others but aren't blocked themselves.
  const renderTree = () => {
    const children = new Map<string, string[]>();
    for (const d of visibleDeps) children.set(d.blockerId, [...(children.get(d.blockerId) ?? []), d.blockedId]);
    const blockedSet = new Set(visibleDeps.map((d) => d.blockedId));
    const roots = linked.filter((t) => !blockedSet.has(t.id));
    const walk = (id: string, depth: number, seen: Set<string>): React.ReactNode => {
      const t = byId.get(id);
      if (!t || seen.has(id)) return null;
      const next = new Set(seen).add(id);
      return (
        <li key={`${id}-${depth}`}>
          <button type="button" onClick={() => openTask(`${project.key}-${t.number}`)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted", chainNodes.has(id) && "font-semibold")} style={{ paddingLeft: 8 + depth * 18 }}>
            {depth > 0 ? <span aria-hidden className="text-muted-foreground">↳</span> : null}
            <StatusIcon status={t.status} />
            <span className="font-tabular text-xs text-muted-foreground">{project.key}-{t.number}</span>
            <span className="truncate">{t.title}</span>
          </button>
          {(children.get(id) ?? []).length ? <ul>{children.get(id)!.map((c) => walk(c, depth + 1, next))}</ul> : null}
        </li>
      );
    };
    return <ul className="rounded-2xl border bg-card p-2" aria-label="Dependency tree (blockers above the tasks they block)">{roots.map((r) => walk(r.id, 0, new Set()))}</ul>;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Dependency map options">
        <Select value={milestone} onValueChange={setMilestone}>
          <SelectTrigger className="h-8 w-44" aria-label="Filter by milestone"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All milestones</SelectItem>
            {milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8 w-44" aria-label="Filter by assignee"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.profile.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-1">
          <Button variant={mode === "map" ? "secondary" : "ghost"} size="sm" onClick={() => setView("map")} aria-pressed={mode === "map"}>
            <Network className="size-4" aria-hidden /> Map
          </Button>
          <Button variant={mode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setView("tree")} aria-pressed={mode === "tree"}>
            <List className="size-4" aria-hidden /> List
          </Button>
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        <span><span className="mr-1 inline-block size-2.5 rounded-sm border-2 border-danger align-middle" />Blocked</span>
        <span><span className="mr-1 inline-block h-1 w-5 rounded bg-accent align-middle" />Longest open chain{chain.length >= 2 ? ` (${chain.length} tasks, ${chain.remainingEffort} pts)` : ""}</span>
        <span>Animated edge = blocker in progress</span>
        {permissions.canEditTasks ? <span>Drag from a node&apos;s bottom handle to another node to add a dependency</span> : null}
      </p>
      {mode === "tree" ? (
        renderTree()
      ) : (
        <div className="h-[70vh] min-h-96 overflow-hidden rounded-2xl border bg-card" data-testid="dependency-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={permissions.canEditTasks}
            onConnect={(c) => void connect(c)}
            onNodeClick={(_, n) => openTask(`${project.key}-${(n.data as NodeData).task.number}`)}
            proOptions={{ hideAttribution: false }}
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
