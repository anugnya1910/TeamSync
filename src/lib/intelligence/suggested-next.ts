/** "Suggested next" for My Tasks (spec §B.21 step 4): deterministic priorityScore + a plain reason. */
import { daysBetween, effectivelyBlocked, openBlockedBy } from "@/lib/algorithms/common";
import { priorityScore } from "@/lib/algorithms/forecast";
import type { DepLite, TaskLite } from "@/lib/algorithms/types";

export type Suggestion = { score: number; reason: string };

export function suggestNext(mine: TaskLite[], related: TaskLite[], deps: DepLite[], today: string): Record<string, Suggestion> {
  const byId = new Map([...related, ...mine].map((t) => [t.id, t]));
  const out: Record<string, Suggestion> = {};
  for (const t of mine) {
    const score = priorityScore(t, { today, deps, byId });
    const bits: string[] = [];
    if (effectivelyBlocked(t, deps, byId)) bits.push("blocked — waiting on other work");
    if (t.dueDate) {
      const d = daysBetween(today, t.dueDate);
      bits.push(d < 0 ? `${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "due today" : d <= 14 ? `due in ${d} day${d === 1 ? "" : "s"}` : "");
    }
    const unblocks = openBlockedBy(t.id, deps, byId);
    if (unblocks) bits.push(`unblocks ${unblocks} task${unblocks === 1 ? "" : "s"}`);
    if (t.status === "in_review") bits.push("in review");
    if (t.priority === "urgent" || t.priority === "high") bits.unshift(`${t.priority} priority`);
    out[t.id] = { score: Math.round(score), reason: bits.filter(Boolean).join(" · ") || "no due date or blockers" };
  }
  return out;
}
