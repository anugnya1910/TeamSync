"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/brand/empty-state";
import { UserAvatar } from "@/components/common/visuals";
import { OTHER_SERIES, type HealthRow, type WorkspaceAnalytics } from "@/lib/intelligence/analytics";
import { cn } from "@/lib/utils";
import { AXIS, ChartCard, GRID, shortDate, TOOLTIP } from "./chart-card";

const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;
const BAND: Record<string, { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "text-success-text" },
  watch: { label: "Watch", cls: "text-info-text" },
  at_risk: { label: "At risk", cls: "text-warning-text" },
  critical: { label: "Critical", cls: "text-danger-text" },
  insufficient_data: { label: "Not enough data", cls: "text-muted-foreground" },
};

type SortKey = "name" | "score" | "openTasks" | "overdue" | "doneLast30";
const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Project" },
  { key: "score", label: "Pulse", numeric: true },
  { key: "openTasks", label: "Open", numeric: true },
  { key: "overdue", label: "Overdue", numeric: true },
  { key: "doneLast30", label: "Done (30 d)", numeric: true },
];

export function WorkspaceAnalyticsView({ analytics: a, slug }: { analytics: WorkspaceAnalytics; slug: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "score", dir: "asc" });
  const rows = useMemo(() => {
    const v = (r: HealthRow) => (sort.key === "name" ? r.name.toLowerCase() : sort.key === "score" ? (r.score ?? (sort.dir === "asc" ? 999 : -1)) : r[sort.key]);
    return [...a.health].sort((x, y) => {
      const p = v(x);
      const q = v(y);
      const c = p < q ? -1 : p > q ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
  }, [a.health, sort]);

  if (a.health.length === 0) {
    return (
      <div className="rounded-2xl border bg-card">
        <EmptyState icon={BarChart3} title="No projects to analyse" description="Create a project or ask to be added to one — analytics roll up the projects you can see." />
      </div>
    );
  }

  const otherLabel = a.throughputSeries.find((s) => s.key === OTHER_SERIES);
  const tpRows = a.throughput.map((r) => ({ ...r, label: shortDate(r.weekStart) }));
  const tpEmpty = a.throughput.every((r) => a.throughputSeries.every((s) => !Number(r[s.key])));

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Active projects", a.totals.projects],
          ["Open tasks", a.totals.openTasks],
          ["Overdue", a.totals.overdue],
          ["Completed (30 days)", a.totals.doneLast30],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{l}</dt>
            <dd className="mt-1 font-tabular text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="health-h" className="rounded-2xl border bg-card">
        <h2 id="health-h" className="px-4 pt-4 text-sm font-semibold">Project health</h2>
        <p className="px-4 text-xs text-muted-foreground">Sorted by Pulse, lowest first, so the projects that need attention lead. Change shows the score movement over the last 7 days.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                {COLS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-4 py-2 font-medium", c.numeric ? "text-right" : "text-left")}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === "asc" ? "desc" : "asc" }))}
                      >
                        {c.label}
                        {active ? sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const band = r.band ? BAND[r.band] : null;
                return (
                  <tr key={r.projectId} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/w/${slug}/p/${r.key}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>{" "}
                      <span className="font-tabular text-xs text-muted-foreground">{r.key}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.score === null ? (
                        <span className="text-xs text-muted-foreground">{r.band ? "Not enough data" : "No snapshot yet"}</span>
                      ) : (
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="font-tabular font-semibold">{r.score}</span>
                          {band ? <span className={cn("text-xs", band.cls)}>{band.label}</span> : null}
                          {r.delta !== null && r.delta !== 0 ? (
                            <span className={cn("font-tabular text-xs", r.delta > 0 ? "text-success-text" : "text-danger-text")} aria-label={`${r.delta > 0 ? "up" : "down"} ${Math.abs(r.delta)} in 7 days`}>
                              {r.delta > 0 ? "+" : "−"}
                              {Math.abs(r.delta)}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-tabular">{r.openTasks}</td>
                    <td className={cn("px-4 py-2 text-right font-tabular", r.overdue > 0 && "font-semibold text-danger-text")}>{r.overdue}</td>
                    <td className="px-4 py-2 text-right font-tabular">{r.doneLast30}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Throughput across projects"
          description={`Tasks completed per week, last 12 weeks${otherLabel ? " — the 4 busiest projects, the rest grouped as Other" : ""}.`}
          filename="workspace-throughput"
          rows={a.throughput}
          columns={[{ key: "weekStart", label: "Week of" }, ...a.throughputSeries.map((s) => ({ key: s.key, label: s.label }))]}
          empty={tpEmpty ? "Nothing completed in the last 12 weeks — complete at least 1 task." : null}
          legend={a.throughputSeries.map((s, i) => ({ label: s.label, color: s.key === OTHER_SERIES ? "var(--muted-foreground)" : C[i]! }))}
        >
          <ResponsiveContainer>
            <BarChart data={tpRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" minTickGap={12} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              {a.throughputSeries.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="tp" fill={s.key === OTHER_SERIES ? "var(--muted-foreground)" : C[i]} stroke="var(--card)" strokeWidth={2} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section aria-labelledby="contrib-h" className="rounded-2xl border bg-card p-4">
          <h3 id="contrib-h" className="text-sm font-semibold">Top contributors</h3>
          <p className="text-xs text-muted-foreground">Effort points completed in the last 30 days, shared between assignees. Members who opted out of leaderboards aren&apos;t ranked.</p>
          {a.contributors.length === 0 || a.contributors.every((c) => c.effort === 0) ? (
            <p className="mt-3 rounded-xl bg-surface-2 p-4 text-center text-sm text-muted-foreground">No completed work in the last 30 days yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {a.contributors.map((c) => (
                <li key={c.userId} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", c.isSelf && "bg-surface-2")}>
                  <span className="w-6 text-right font-tabular text-xs text-muted-foreground">{c.rank ?? "–"}</span>
                  <UserAvatar name={c.name} url={c.avatarUrl} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.name}
                    {c.isSelf ? <span className="text-muted-foreground"> (you{c.rank === null ? ", not ranked" : ""})</span> : null}
                  </span>
                  <span className="font-tabular text-sm font-semibold">{c.effort} pts</span>
                  <span className="w-16 text-right font-tabular text-xs text-muted-foreground">{c.tasks} task{c.tasks === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
