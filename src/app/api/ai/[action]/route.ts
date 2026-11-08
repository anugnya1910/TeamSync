import { formatInTimeZone } from "date-fns-tz";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { consideredTasks, isOpen } from "@/lib/algorithms/common";
import { breakdownFallback, planFallback, prioritiesFallback, risksFallback, statNumbers, summaryFallback, type ProjectStats } from "@/lib/ai/fallbacks";
import { breakdownPrompt, planPrompt, prioritiesPrompt, risksPrompt, summaryPrompt } from "@/lib/ai/prompts";
import { runAiAction } from "@/lib/ai/run-ai";
import { breakdownSchema, planSchema, prioritiesSchema, risksSchema, summarySchema, type AiAction } from "@/lib/ai/schemas";
import { analyse, loadProjectData } from "@/lib/intelligence/project.server";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, AiAction> = {
  breakdown: "breakdown",
  summary: "summary",
  "plan-project": "plan_project",
  priorities: "priorities",
  risks: "risks",
};
const WRITE_ACTIONS: AiAction[] = ["breakdown", "plan_project", "priorities"];
const MAX_BODY = 8 * 1024;
const bodySchema = z.object({
  taskId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  goal: z.string().max(2000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Best-effort per-instance limiter (the DB quota is authoritative).
const hits = new Map<string, number[]>();
function softLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 10;
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/ai/[action]">) {
  const { action: slug } = await ctx.params;
  const action = ACTIONS[slug];
  if (!action) return json({ error: "unknown action" }, 404);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "expected JSON" }, 415);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "request too large" }, 413);
  const userId = await getCurrentUserId();
  if (!userId) return json({ error: "unauthenticated" }, 401);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (softLimited(`${ip}:${userId}`)) return json({ error: "Too many AI requests — wait a minute." }, 429);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(raw || "{}"));
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = profile?.timezone ?? "UTC";

  // Resolve the project (and task) under RLS — foreign ids simply aren't visible.
  let projectId = body.projectId ?? null;
  let task: { id: string; title: string; description: string | null; effort_points: number | null; project_id: string } | null = null;
  if (action === "breakdown") {
    if (!body.taskId) return json({ error: "taskId required" }, 400);
    const { data } = await supabase.from("tasks").select("id, title, description, effort_points, project_id").eq("id", body.taskId).maybeSingle();
    if (!data) return json({ error: "not found" }, 404);
    task = data;
    projectId = data.project_id;
  }
  if (!projectId) return json({ error: "projectId required" }, 400);
  const { data: project } = await supabase.from("projects").select("id, name, workspace_id, start_date, target_date").eq("id", projectId).maybeSingle();
  if (!project) return json({ error: "not found" }, 404);
  if (WRITE_ACTIONS.includes(action)) {
    const { data: canEdit } = await supabase.rpc("can_edit_project_content", { p: project.id });
    if (!canEdit) return json({ error: "You need contributor access to use this." }, 403);
  }

  const common = { supabase, workspaceId: project.workspace_id, action };

  if (action === "breakdown" && task) {
    const t = task;
    const res = await runAiAction({
      ...common,
      prompt: breakdownPrompt(t.title, t.description ?? "", t.effort_points),
      schema: breakdownSchema,
      fallback: () => breakdownFallback(t.title, t.description, t.effort_points),
    });
    return json(res);
  }

  if (action === "plan_project") {
    const goal = (body.goal ?? project.name).trim();
    const start = body.startDate ?? project.start_date;
    const target = body.targetDate ?? project.target_date;
    const res = await runAiAction({ ...common, prompt: planPrompt(goal, start, target), schema: planSchema, fallback: () => planFallback(goal, start, target) });
    return json(res);
  }

  const data = await loadProjectData(supabase, project.id, tz);
  if (!data) return json({ error: "not found" }, 404);
  const intel = analyse(data);

  if (action === "priorities") {
    const open = consideredTasks(data.tasks).filter(isOpen).slice(0, 40);
    const ids = new Set(open.map((t) => t.id));
    const input = open.map((t) => ({
      taskId: t.id,
      key: t.key,
      title: (t.title ?? "").slice(0, 120),
      priority: t.priority,
      status: t.status,
      due: t.dueDate,
      blocking: data.deps.filter((d) => d.blockerId === t.id).length,
    }));
    const res = await runAiAction({
      ...common,
      prompt: prioritiesPrompt(input),
      schema: prioritiesSchema,
      fallback: () => prioritiesFallback(open, data.deps, data.today),
      validate: (d) => d.ranked.every((r) => ids.has(r.taskId)),
    });
    return json({ ...res, keys: Object.fromEntries(open.map((t) => [t.id, `${t.key} · ${t.title}`])) });
  }

  if (action === "risks") {
    const input = {
      pulseScore: intel.pulse.score,
      overdueTasks: intel.pulse.stats.overdueTasks,
      blockedTasks: intel.pulse.stats.blockedTasks,
      risks: intel.risks.slice(0, 8).map((r) => ({ type: r.type, severity: r.severity, message: r.message })),
    };
    const allowed = [String(input.pulseScore ?? ""), String(input.overdueTasks), String(input.blockedTasks), 3, ...input.risks.flatMap((r) => r.message.match(/\d+(?:\.\d+)?/g) ?? [])];
    const res = await runAiAction({
      ...common,
      prompt: risksPrompt(input),
      schema: risksSchema,
      fallback: () => risksFallback(intel.risks),
      groundNumbers: (d) => ({ text: `${d.narrative} ${d.actions.join(" ")}`, allowed }),
    });
    return json(res);
  }

  // summary
  const considered = consideredTasks(data.tasks);
  const weekAgo = formatInTimeZone(new Date(Date.now() - 6 * 86_400_000), tz, "yyyy-MM-dd");
  const next = data.milestones
    .filter((m) => m.status === "open")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];
  const stats: ProjectStats = {
    name: project.name,
    totalTasks: considered.length,
    openTasks: considered.filter(isOpen).length,
    doneTasks: considered.filter((t) => t.status === "done").length,
    completionPct: intel.pulse.stats.totalEffort ? Math.round((intel.pulse.stats.doneEffort / intel.pulse.stats.totalEffort) * 100) : 0,
    overdueTasks: intel.pulse.stats.overdueTasks,
    blockedTasks: intel.pulse.stats.blockedTasks,
    pulseScore: intel.pulse.score,
    pulseBand: intel.pulse.band,
    topRisk: intel.risks[0]?.message ?? null,
    nextMilestone: next ? { name: next.name, due: next.dueDate, forecast: intel.milestoneForecasts[next.id]?.forecast ?? null } : null,
    completedThisWeek: considered.filter((t) => t.status === "done" && t.completedDate && t.completedDate >= weekAgo).length,
  };
  const allowed = [...statNumbers(stats), ...(stats.topRisk?.match(/\d+(?:\.\d+)?/g) ?? [])];
  const res = await runAiAction({
    ...common,
    prompt: summaryPrompt(stats),
    schema: summarySchema,
    fallback: () => summaryFallback(stats),
    groundNumbers: (d) => ({ text: d.markdown, allowed }),
  });
  return json({ ...res, stats });
}

export function GET() {
  return json({ error: "method not allowed" }, 405);
}
