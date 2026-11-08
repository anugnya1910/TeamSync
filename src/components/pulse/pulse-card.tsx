"use client";

import { Info, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { BAND_COLOR, PulseRing } from "@/components/brand/pulse-ring";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PulseResult } from "@/lib/algorithms/pulse";
import { RISK_LABELS, type Risk } from "@/lib/algorithms/risk";
import { cn } from "@/lib/utils";

const BAND_LABEL = { healthy: "Healthy", watch: "Watch", at_risk: "At risk", critical: "Critical", insufficient_data: "Not enough data" } as const;

const FACTOR_HELP: Record<string, string> = {
  schedule: "Share of effort done compared with how much of the timeline has passed (or plain completion when no dates are set). Capped at 30% after the target date.",
  overdue: "Overdue open work weighted by priority and by how late it is, relative to all open work.",
  deadline: "Of the work due in the next 3 days, how much has started. Milestones forecast to finish late cost 10% each.",
  blocked: "Share of open effort that is blocked (manual flag or an unfinished dependency). Blocked urgent work caps this at 60%.",
  workload: "1 − imbalance index of member utilisation. Capped at 70% when anyone is overloaded.",
};

export type TrendPoint = { date: string; score: number | null };

function Sparkline({ points }: { points: TrendPoint[] }) {
  const valid = points.filter((p): p is { date: string; score: number } => p.score !== null);
  if (valid.length < 2) return <p className="text-xs text-muted-foreground">Trend appears after 2 daily snapshots.</p>;
  const w = 160;
  const h = 32;
  const step = w / (valid.length - 1);
  const d = valid.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p.score / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} role="img" aria-label={`Pulse trend over ${valid.length} days: from ${valid[0]!.score} to ${valid[valid.length - 1]!.score}`} className="overflow-visible">
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export function PulseCard({
  pulse,
  basePath,
  updatedAt,
  trend,
  children,
}: {
  pulse: PulseResult;
  basePath: string;
  updatedAt: string;
  trend: TrendPoint[];
  children?: React.ReactNode;
}) {
  const color = pulse.band === "insufficient_data" ? "var(--muted-foreground)" : BAND_COLOR[pulse.band];
  return (
    <section aria-labelledby="pulse-h" className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 id="pulse-h" className="text-card-title">Project Pulse</h2>
        <Badge variant="outline" style={{ color, borderColor: color }}>{BAND_LABEL[pulse.band]}</Badge>
      </div>
      <div className="flex items-center gap-4">
        <PulseRing
          score={pulse.score}
          size="md"
          factors={pulse.factors.map((f) => ({ weight: f.weight, subScore: f.subScore, label: `${f.label}: ${f.points.toFixed(1)} / ${f.weight}` }))}
          caption={pulse.score === null ? undefined : BAND_LABEL[pulse.band]}
        />
        <div className="min-w-0 space-y-1 text-sm">
          {pulse.score === null ? (
            <p className="text-muted-foreground">Add at least 3 tasks to see this project&apos;s health.</p>
          ) : (
            <p>
              <span className="sr-only">Project health {pulse.score} out of 100, {BAND_LABEL[pulse.band]}. </span>
              {pulse.stats.openTasks} open · {pulse.stats.overdueTasks} overdue · {pulse.stats.blockedTasks} blocked
            </p>
          )}
          <Sparkline points={trend} />
          <p className="text-xs text-muted-foreground">Updated {new Date(updatedAt).toLocaleString()}</p>
        </div>
      </div>

      {pulse.factors.length ? (
        <ul className="space-y-2" aria-label="Pulse factors">
          {pulse.factors.map((f) => (
            <li key={f.key} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{f.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground" aria-label={`How ${f.label} is calculated`}>
                      <Info className="size-3" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">{FACTOR_HELP[f.key]}</TooltipContent>
                </Tooltip>
                <span className="ml-auto font-tabular text-muted-foreground">{f.points.toFixed(1)} / {f.weight}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${f.subScore * 100}%`, background: color }} />
              </div>
              <p className="text-[11px] text-muted-foreground">{f.note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {pulse.reasons.length && pulse.score !== null ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Why this score</h3>
          <ul className="space-y-1 text-sm">{pulse.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      ) : null}
      {pulse.infos.length ? <ul className="space-y-1 text-xs text-muted-foreground">{pulse.infos.map((i) => <li key={i}>ℹ {i}</li>)}</ul> : null}
      {pulse.actions.length ? (
        <div className="flex flex-wrap gap-2">
          {pulse.actions.map((a) => (
            <Link key={a.href} href={`${basePath}/${a.href}`} className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted">
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const SEV_STYLE = { high: "text-danger-text border-danger/40", medium: "text-warning-text border-warning/50", low: "text-muted-foreground border-border" };

export function TopRisks({ risks, taskKeyById, basePath, children }: { risks: Risk[]; taskKeyById: Record<string, string>; basePath: string; children?: React.ReactNode }) {
  return (
    <section aria-labelledby="risks-h" className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="size-4 text-primary" aria-hidden />
        <h2 id="risks-h" className="text-card-title">Top risks</h2>
        <span className="ml-auto text-xs text-muted-foreground">{risks.length} found</span>
      </div>
      {risks.length ? (
        <ul className="space-y-2">
          {risks.slice(0, 6).map((r, i) => (
            <li key={`${r.type}-${r.taskId ?? r.milestoneId}-${i}`} className="flex items-start gap-2 text-sm">
              <span className={cn("shrink-0 rounded border px-1.5 text-[10px] font-semibold uppercase", SEV_STYLE[r.severity])}>{r.severity}</span>
              <span className="min-w-0">
                <span className="text-xs text-muted-foreground">{RISK_LABELS[r.type]} · </span>
                {r.taskId && taskKeyById[r.taskId] ? (
                  <Link className="hover:underline" href={`${basePath}/board?task=${taskKeyById[r.taskId]}`}>{r.message}</Link>
                ) : (
                  r.message
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No risks detected right now.</p>
      )}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
