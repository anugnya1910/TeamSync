"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/domain";
import type { PeriodKey, ProjectAnalytics } from "@/lib/intelligence/analytics";
import { cn } from "@/lib/utils";
import { AXIS, ChartCard, GRID, shortDate, TOOLTIP } from "./chart-card";

const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
const BAR = { radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 28 };
const PERIOD_LABEL: Record<PeriodKey, string> = { "14": "14 days", "30": "30 days", "90": "90 days", all: "Lifetime" };
const CFD_KEYS = ["backlog", "todo", "in_progress", "in_review", "done"] as const;
const pctOrDash = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-tabular text-2xl font-semibold">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11px] text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

export function ProjectAnalyticsView({ analytics: a, milestones, milestoneId }: { analytics: ProjectAnalytics; milestones: { id: string; name: string }[]; milestoneId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [throughputUnit, setThroughputUnit] = useState<"tasks" | "effort">("tasks");
  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  };
  const noTasks = a.totalTasks === 0 ? "No tasks yet — add at least 1 task to see this chart." : null;
  const scored = a.pulseTrend.filter((p) => p.score !== null).length;
  const throughputEmpty = a.throughput.every((p) => p.tasks === 0);
  const tp = a.throughput.map((p) => ({ ...p, label: shortDate(p.weekStart) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Period" className="flex gap-1 rounded-lg border bg-card p-0.5">
          {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => (
            <Link
              key={k}
              href={href({ range: k === "30" ? null : k })}
              aria-current={a.period.key === k ? "page" : undefined}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", a.period.key === k ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {PERIOD_LABEL[k]}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">
          {shortDate(a.period.start)} – {shortDate(a.period.end)} · {a.period.days} day{a.period.days === 1 ? "" : "s"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open tasks" value={String(a.kpis.openTasks)} />
        <Kpi label="Completed this week" value={String(a.kpis.completedThisWeek)} />
        <Kpi label="On-time rate" value={pctOrDash(a.kpis.onTime.rate)} hint={a.kpis.onTime.sample ? `${a.kpis.onTime.sample} done task${a.kpis.onTime.sample === 1 ? "" : "s"} with a due date` : "Needs a completed task with a due date"} />
        <Kpi label="Median cycle time" value={a.kpis.cycle.median === null ? "—" : `${a.kpis.cycle.median} d`} hint={a.kpis.cycle.sample ? `In progress → done, ${a.kpis.cycle.sample} task${a.kpis.cycle.sample === 1 ? "" : "s"}` : "Needs a task moved from In progress to Done"} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Burndown"
          description={a.hasIdeal ? "Remaining effort (points) at the end of each day, against an ideal line to the target date." : milestoneId ? "Remaining effort (points) for this milestone." : "Remaining effort (points) at the end of each day. Set a target date to add the ideal line."}
          filename="burndown"
          rows={a.burndown}
          columns={[{ key: "date", label: "Date" }, { key: "remaining", label: "Remaining (pts)" }, { key: "ideal", label: "Ideal (pts)", format: (v) => (v === null ? "—" : String(v)) }]}
          empty={noTasks}
          legend={[{ label: "Remaining", color: C[0] }, ...(a.hasIdeal ? [{ label: "Ideal", color: "var(--muted-foreground)", dashed: true }] : [])]}
          actions={
            milestones.length ? (
              <Select value={milestoneId ?? "all"} onValueChange={(v) => router.push(href({ ms: v === "all" ? null : v }), { scroll: false })}>
                <SelectTrigger className="h-7 w-40 text-xs" aria-label="Burndown milestone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole project</SelectItem>
                  {milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null
          }
        >
          <ResponsiveContainer>
            <LineChart data={a.burndown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} />
              <Line type="monotone" dataKey="remaining" name="Remaining" stroke={C[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
              {a.hasIdeal ? <Line type="linear" dataKey="ideal" name="Ideal" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Throughput"
          description={`${throughputUnit === "tasks" ? "Tasks" : "Effort points"} completed per week, last 12 weeks.`}
          filename="throughput"
          rows={a.throughput}
          columns={[{ key: "weekStart", label: "Week of" }, { key: "tasks", label: "Tasks" }, { key: "effort", label: "Effort (pts)" }]}
          empty={throughputEmpty ? "Nothing completed in the last 12 weeks — complete at least 1 task." : null}
          actions={
            <div className="flex gap-0.5" role="group" aria-label="Throughput unit">
              {(["tasks", "effort"] as const).map((u) => (
                <Button key={u} size="xs" variant={throughputUnit === u ? "secondary" : "ghost"} aria-pressed={throughputUnit === u} onClick={() => setThroughputUnit(u)}>
                  {u === "tasks" ? "Tasks" : "Points"}
                </Button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer>
            <BarChart data={tp} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" minTickGap={12} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey={throughputUnit} name={throughputUnit === "tasks" ? "Tasks" : "Points"} fill={C[0]} {...BAR} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Workload distribution"
          description="Weighted open load against weekly capacity (points), per active member."
          filename="workload"
          rows={a.workload}
          columns={[{ key: "name", label: "Member" }, { key: "load", label: "Load (pts)" }, { key: "capacity", label: "Capacity (pts)" }]}
          empty={a.workload.length ? null : "No active members — add a lead or contributor with capacity above 0."}
          legend={[{ label: "Load", color: C[0] }, { label: "Capacity", color: "var(--muted-foreground)" }]}
        >
          <ResponsiveContainer>
            <BarChart data={a.workload} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="name" width={96} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="load" name="Load" fill={C[0]} radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="capacity" name="Capacity" fill="var(--muted-foreground)" fillOpacity={0.35} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Member contributions"
          description="In this period: effort points completed (shared between assignees), comments written and reviews (In review → Done)."
          filename="contributions"
          rows={a.contributions}
          columns={[{ key: "name", label: "Member" }, { key: "effort", label: "Effort done (pts)" }, { key: "comments", label: "Comments" }, { key: "reviews", label: "Reviews" }]}
          empty={a.contributions.length ? null : "No completed work, comments or reviews in this period yet."}
          legend={[{ label: "Effort (pts)", color: C[0] }, { label: "Comments", color: C[1] }, { label: "Reviews", color: C[2] }]}
        >
          <ResponsiveContainer>
            <BarChart data={a.contributions} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" interval={0} tickFormatter={(n: string) => n.split(" ")[0] ?? n} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="effort" name="Effort (pts)" fill={C[0]} {...BAR} maxBarSize={16} />
              <Bar dataKey="comments" name="Comments" fill={C[1]} {...BAR} maxBarSize={16} />
              <Bar dataKey="reviews" name="Reviews" fill={C[2]} {...BAR} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Pulse trend"
          description="Daily Project Pulse score (0–100). Background bands: Critical < 40, At risk < 60, Watch < 80, Healthy ≥ 80."
          filename="pulse-trend"
          rows={a.pulseTrend}
          columns={[{ key: "date", label: "Date" }, { key: "score", label: "Score", format: (v) => (v === null ? "Not enough data" : String(v)) }]}
          empty={scored < 2 ? `The trend appears after 2 daily snapshots (${scored} so far in this period).` : null}
        >
          <ResponsiveContainer>
            <LineChart data={a.pulseTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <ReferenceArea y1={0} y2={40} fill="var(--danger)" fillOpacity={0.06} ifOverflow="hidden" />
              <ReferenceArea y1={40} y2={60} fill="var(--warning)" fillOpacity={0.07} ifOverflow="hidden" />
              <ReferenceArea y1={60} y2={80} fill="var(--info)" fillOpacity={0.05} ifOverflow="hidden" />
              <ReferenceArea y1={80} y2={100} fill="var(--success)" fillOpacity={0.07} ifOverflow="hidden" />
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...AXIS} />
              <YAxis domain={[0, 100]} ticks={[0, 40, 60, 80, 100]} {...AXIS} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} />
              <Line type="monotone" dataKey="score" name="Pulse" stroke={C[0]} strokeWidth={2} connectNulls dot={{ r: 3, fill: C[0], stroke: "var(--card)", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Risks by type"
          description="Open risks detected today (overdue, stale, blocked high-priority work, schedule conflicts…)."
          filename="risks"
          rows={a.risks}
          columns={[{ key: "label", label: "Risk" }, { key: "count", label: "Count" }]}
          empty={a.risks.length ? null : "No risks detected right now."}
        >
          <ResponsiveContainer>
            <BarChart data={a.risks} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="label" width={132} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="count" name="Risks" fill={C[0]} radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Overdue by priority"
          description="Open tasks past their due date, grouped by priority."
          filename="overdue-by-priority"
          rows={a.overdueByPriority}
          columns={[{ key: "priority", label: "Priority", format: (v) => PRIORITY_LABELS[v as keyof typeof PRIORITY_LABELS] }, { key: "count", label: "Overdue tasks" }]}
          empty={a.overdueByPriority.some((p) => p.count > 0) ? null : "Nothing is overdue."}
        >
          <ResponsiveContainer>
            <BarChart data={a.overdueByPriority.map((p) => ({ ...p, label: PRIORITY_LABELS[p.priority] }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" interval={0} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="count" name="Overdue" fill={C[0]} {...BAR} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Cumulative flow"
          description="Effort points in each status at the end of each day (cancelled excluded)."
          filename="cumulative-flow"
          rows={a.cfd}
          columns={[{ key: "date", label: "Date" }, ...CFD_KEYS.map((k) => ({ key: k, label: `${STATUS_LABELS[k]} (pts)` }))]}
          empty={noTasks}
          legend={CFD_KEYS.map((k, i) => ({ label: STATUS_LABELS[k], color: C[i]! }))}
        >
          <ResponsiveContainer>
            <AreaChart data={a.cfd} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} />
              {[...CFD_KEYS].reverse().map((k) => {
                const i = CFD_KEYS.indexOf(k);
                return <Area key={k} type="monotone" dataKey={k} name={STATUS_LABELS[k]} stackId="cfd" stroke="var(--card)" strokeWidth={2} fill={C[i]} fillOpacity={0.85} />;
              })}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Cycle time"
          description={a.kpis.cycle.sample ? `Days from In progress to Done for tasks finished in this period. Median ${a.kpis.cycle.median} d, 85th percentile ${a.kpis.cycle.p85} d.` : "Days from In progress to Done."}
          filename="cycle-time"
          rows={a.cycleHistogram}
          columns={[{ key: "bucket", label: "Cycle time" }, { key: "tasks", label: "Tasks" }]}
          empty={a.kpis.cycle.sample ? null : "Needs at least 1 task moved from In progress to Done in this period."}
        >
          <ResponsiveContainer>
            <BarChart data={a.cycleHistogram} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="bucket" interval={0} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="tasks" name="Tasks" fill={C[0]} {...BAR} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
