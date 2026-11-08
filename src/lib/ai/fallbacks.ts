/** Deterministic, rule-based generators used whenever AI is unavailable (spec §B.22). Pure. */
import { addDaysIso, daysBetween } from "@/lib/algorithms/common";
import { priorityScore } from "@/lib/algorithms/forecast";
import { RISK_LABELS, type Risk } from "@/lib/algorithms/risk";
import type { DepLite, TaskLite } from "@/lib/algorithms/types";
import { EFFORTS, type BreakdownOut, type PlanOut, type PrioritiesOut, type RisksOut, type SummaryOut } from "./schemas";

const FAMILIES: { match: RegExp; steps: string[] }[] = [
  { match: /\b(report|document|docs?|write|paper|thesis|essay|presentation|slides)\b/i, steps: ["Outline the structure", "Draft the sections", "Add references and figures", "Review and revise", "Format and finalise"] },
  { match: /\b(api|backend|endpoint|server|database|schema|auth)\b/i, steps: ["Design the schema and contract", "Implement the endpoints", "Add validation and error handling", "Write tests", "Document the API"] },
  { match: /\b(ui|page|screen|frontend|component|design|layout)\b/i, steps: ["Sketch the layout", "Build the component", "Handle loading, empty and error states", "Make it responsive and accessible", "Review with the team"] },
  { match: /\b(event|venue|workshop|meetup|fest|seminar)\b/i, steps: ["Confirm requirements and budget", "Book resources", "Coordinate people", "Run a final check", "Collect feedback"] },
  { match: /\b(research|survey|study|analy[sz]e|literature|investigate)\b/i, steps: ["Define the questions", "Gather sources and data", "Analyse findings", "Summarise insights", "Review with the team"] },
  { match: /\b(test|qa|bug|fix|debug)\b/i, steps: ["Reproduce the problem", "Identify the root cause", "Implement the fix", "Add a regression test", "Verify and close"] },
];
const DEFAULT_STEPS = ["Research", "Implement", "Test", "Document", "Review"];

/**
 * Splits an effort total into `n` valid estimates (1,2,3,5,8,13) that sum to `total` whenever
 * that is possible, preferring the most even split; otherwise the closest achievable sum.
 * n ≤ 5, so an exhaustive search over non-increasing combinations is tiny.
 */
export function splitEffort(total: number, n: number): number[] {
  const E = [...EFFORTS].sort((a, b) => b - a);
  let best: number[] | null = null;
  let bestKey: [number, number] = [Infinity, Infinity];
  const walk = (parts: number[], from: number) => {
    if (parts.length === n) {
      const sum = parts.reduce((s, p) => s + p, 0);
      const key: [number, number] = [Math.abs(sum - total), parts[0]! - parts[parts.length - 1]!];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = [...parts];
        bestKey = key;
      }
      return;
    }
    for (let i = from; i < E.length; i++) walk([...parts, E[i]!], i);
  };
  walk([], 0);
  return best ?? Array.from({ length: n }, () => 1);
}

export function breakdownFallback(title: string, description: string | null, parentEffort: number | null): BreakdownOut {
  const text = `${title} ${description ?? ""}`;
  const steps = FAMILIES.find((f) => f.match.test(text))?.steps ?? DEFAULT_STEPS;
  const total = parentEffort ?? steps.length;
  const n = Math.min(steps.length, Math.max(1, total));
  const efforts = splitEffort(total, n);
  return { subtasks: steps.slice(0, n).map((s, i) => ({ title: s, effort: efforts[i] as BreakdownOut["subtasks"][number]["effort"] })) };
}

export type ProjectStats = {
  name: string;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  completionPct: number;
  overdueTasks: number;
  blockedTasks: number;
  pulseScore: number | null;
  pulseBand: string;
  topRisk: string | null;
  nextMilestone: { name: string; due: string | null; forecast: string | null } | null;
  completedThisWeek: number;
};

/** Numbers the summary may legitimately mention. */
export function statNumbers(s: ProjectStats): (number | string)[] {
  const nums: (number | string)[] = [s.totalTasks, s.openTasks, s.doneTasks, s.completionPct, s.overdueTasks, s.blockedTasks, s.completedThisWeek];
  if (s.pulseScore !== null) nums.push(s.pulseScore, 100);
  for (const d of [s.nextMilestone?.due, s.nextMilestone?.forecast]) if (d) nums.push(...d.split("-"));
  return nums;
}

export function summaryFallback(s: ProjectStats): SummaryOut {
  const lines = [
    `**${s.name}** is ${s.completionPct}% complete: ${s.doneTasks} of ${s.totalTasks} tasks done, ${s.openTasks} still open.`,
    s.pulseScore !== null ? `Project Pulse is ${s.pulseScore}/100 (${s.pulseBand.replace("_", " ")}).` : "There isn't enough data for a Pulse score yet.",
    s.overdueTasks || s.blockedTasks
      ? `${s.overdueTasks} task${s.overdueTasks === 1 ? " is" : "s are"} overdue and ${s.blockedTasks} ${s.blockedTasks === 1 ? "is" : "are"} blocked.`
      : "Nothing is overdue or blocked.",
    `${s.completedThisWeek} task${s.completedThisWeek === 1 ? " was" : "s were"} completed this week.`,
    s.topRisk ? `Top risk: ${s.topRisk}.` : "",
    s.nextMilestone
      ? `Next milestone: ${s.nextMilestone.name}${s.nextMilestone.due ? ` (due ${s.nextMilestone.due})` : ""}${
          s.nextMilestone.forecast ? `, forecast ${s.nextMilestone.forecast}` : ", not enough history to forecast"
        }.`
      : "",
  ];
  return { markdown: lines.filter(Boolean).join(" ") };
}

const PLAN_TEMPLATES: { match: RegExp; milestones: { name: string; tasks: string[] }[] }[] = [
  { match: /\b(app|software|website|api|system|platform|code)\b/i, milestones: [
    { name: "Requirements", tasks: ["Write user stories", "Agree on scope", "Choose the tech stack"] },
    { name: "Build", tasks: ["Set up the repository", "Implement core features", "Integrate data storage"] },
    { name: "Test", tasks: ["Write automated tests", "Fix bugs", "Usability review"] },
    { name: "Launch", tasks: ["Deploy", "Write documentation", "Demo to stakeholders"] },
  ] },
  { match: /\b(research|study|survey|thesis|paper)\b/i, milestones: [
    { name: "Plan", tasks: ["Define research questions", "Review literature", "Design the method"] },
    { name: "Collect", tasks: ["Prepare instruments", "Collect data", "Clean the data"] },
    { name: "Analyse", tasks: ["Run the analysis", "Interpret results", "Draft findings"] },
    { name: "Report", tasks: ["Write the report", "Peer review", "Present results"] },
  ] },
  { match: /\b(event|fest|workshop|conference|meetup|hackathon)\b/i, milestones: [
    { name: "Plan", tasks: ["Set goals and budget", "Book the venue", "Confirm speakers"] },
    { name: "Promote", tasks: ["Design posters", "Social media campaign", "Open registrations"] },
    { name: "Execute", tasks: ["Arrange logistics", "Brief volunteers", "Run the event"] },
    { name: "Wrap-up", tasks: ["Collect feedback", "Settle accounts", "Share highlights"] },
  ] },
];
const DEFAULT_PLAN = [
  { name: "Plan", tasks: ["Define the goal", "Break down the work", "Assign owners"] },
  { name: "Do", tasks: ["Complete the main work", "Check progress weekly", "Resolve blockers"] },
  { name: "Review", tasks: ["Review the results", "Document learnings", "Share the outcome"] },
];

export function planFallback(goal: string, startDate: string | null, targetDate: string | null): PlanOut {
  const tpl = PLAN_TEMPLATES.find((t) => t.match.test(goal))?.milestones ?? DEFAULT_PLAN;
  const span = startDate && targetDate ? Math.max(daysBetween(startDate, targetDate), tpl.length) : tpl.length * 14;
  return {
    milestones: tpl.map((m, i) => ({
      name: m.name,
      dueOffsetDays: Math.round(((i + 1) / tpl.length) * span),
      tasks: m.tasks.map((t) => ({ title: t, description: "", priority: "medium" as const, effort: 3 as const })),
    })),
  };
}

export function prioritiesFallback(tasks: TaskLite[], deps: DepLite[], today: string): PrioritiesOut {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ranked = tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .map((t) => ({ t, score: priorityScore(t, { today, deps, byId }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ t, score }) => {
      const bits = [`priority ${t.priority}`];
      if (t.dueDate) bits.push(t.dueDate < today ? `overdue since ${t.dueDate}` : `due ${t.dueDate}`);
      const blocking = deps.filter((d) => d.blockerId === t.id).length;
      if (blocking) bits.push(`blocks ${blocking} task${blocking === 1 ? "" : "s"}`);
      if (t.status === "in_review") bits.push("waiting for review");
      return { taskId: t.id, reason: `Score ${Math.round(score)}: ${bits.join(", ")}` };
    });
  return { ranked: ranked.length ? ranked : [] };
}

export function risksFallback(risks: Risk[]): RisksOut {
  const top = risks.slice(0, 3);
  const narrative = top.length
    ? `The main risks right now: ${top.map((r) => `${RISK_LABELS[r.type].toLowerCase()} — ${r.message}`).join("; ")}.`
    : "No risks were detected from the current tasks, dependencies and workload.";
  const actions = [
    risks.some((r) => r.type === "OVERDUE") ? "Review overdue tasks and agree new dates or owners." : "Keep due dates up to date so risks surface early.",
    risks.some((r) => r.type === "BLOCKED_HIGH_PRIORITY" || r.type === "CRITICAL_CHAIN") ? "Unblock the highest-priority blocked work first." : "Check dependencies before starting new work.",
    risks.some((r) => r.type === "OWNER_OVERLOADED") ? "Rebalance work from overloaded members on the Workload page." : "Review the workload balance weekly.",
  ];
  return { narrative, actions };
}

export { addDaysIso };
