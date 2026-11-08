"use client";

import { useId, useMemo, useState } from "react";
import { PulseRing } from "@/components/brand/pulse-ring";
import { Slider } from "@/components/ui/slider";
import {
  BAND_LABELS,
  computePulseDemo,
  type PulseDemoInput,
} from "@/lib/algorithms/pulse-demo";
import { cn } from "@/lib/utils";

type SliderDef = { key: keyof PulseDemoInput; label: string; hint: string; scale: "pct" | "index" };

const SLIDERS: SliderDef[] = [
  { key: "completion", label: "Work completed", hint: "share of total effort done", scale: "pct" },
  { key: "timelineElapsed", label: "Timeline elapsed", hint: "how far between start and target", scale: "pct" },
  { key: "overdueShare", label: "Overdue work", hint: "share of open effort past due", scale: "pct" },
  { key: "dueSoonNotStartedShare", label: "Due soon, not started", hint: "of work due within 3 days", scale: "pct" },
  { key: "blockedShare", label: "Blocked work", hint: "share of open effort blocked", scale: "pct" },
  { key: "workloadImbalance", label: "Workload imbalance", hint: "0 = perfectly even, 1 = very uneven", scale: "index" },
];

const INITIAL: PulseDemoInput = {
  completion: 0.45,
  timelineElapsed: 0.5,
  overdueShare: 0.1,
  dueSoonNotStartedShare: 0.2,
  blockedShare: 0.05,
  workloadImbalance: 0.3,
};

/** Interactive formula demo — computes from the visitor's slider values only. */
export function PulseDemo() {
  const [input, setInput] = useState<PulseDemoInput>(INITIAL);
  const result = useMemo(() => computePulseDemo(input), [input]);
  const baseId = useId();

  return (
    <div className="grid gap-8 rounded-2xl border bg-card p-5 sm:p-8 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="grid content-start gap-5 sm:grid-cols-2">
        {SLIDERS.map((s) => {
          const value = input[s.key];
          const id = `${baseId}-${s.key}`;
          return (
            <div key={s.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{s.label}</span>
                <output className="font-tabular text-sm" data-testid={`demo-value-${s.key}`}>
                  {s.scale === "pct" ? `${Math.round(value * 100)}%` : value.toFixed(2)}
                </output>
              </div>
              <Slider
                id={id}
                thumbLabel={s.label}
                min={0}
                max={100}
                step={1}
                value={[Math.round(value * 100)]}
                onValueChange={(v) => setInput((prev) => ({ ...prev, [s.key]: (v[0] ?? 0) / 100 }))}
              />
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-5 rounded-xl bg-surface-2 p-5">
        <PulseRing
          score={result.score}
          factors={result.factors}
          size="lg"
          caption={BAND_LABELS[result.band]}
        />
        <p className="sr-only" aria-live="polite" data-testid="demo-score">
          Pulse score {result.score}, {BAND_LABELS[result.band]}
        </p>
        <p className="text-center text-sm">
          <span className="font-medium">Top reason: </span>
          <span className="text-muted-foreground">{result.topReason}</span>
        </p>
        <ul className="w-full space-y-2.5" aria-label="Factor breakdown">
          {result.factors.map((f) => (
            <li key={f.key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{f.label}</span>
                <span className="font-tabular text-muted-foreground">
                  {f.points.toFixed(1)} / {f.weight}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                <div
                  className={cn("h-full rounded-full bg-primary transition-[width] duration-300")}
                  style={{ width: `${f.subScore * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
