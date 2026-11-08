"use client";

import { FolderKanban } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { Logo } from "@/components/brand/logo";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { PulseRing } from "@/components/brand/pulse-ring";
import { StatusIcon } from "@/components/brand/status-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain";
import { contrastRatio } from "@/lib/utils/contrast";
import { cn } from "@/lib/utils";

type Pair = { fg: string; bg: string; min: number; kind: "text" | "ui" };

const PAIRS: Pair[] = [
  { fg: "--foreground", bg: "--background", min: 4.5, kind: "text" },
  { fg: "--foreground", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--foreground", bg: "--surface-2", min: 4.5, kind: "text" },
  { fg: "--muted-foreground", bg: "--background", min: 4.5, kind: "text" },
  { fg: "--muted-foreground", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--muted-foreground", bg: "--surface-2", min: 4.5, kind: "text" },
  { fg: "--primary-foreground", bg: "--primary", min: 4.5, kind: "text" },
  { fg: "--primary", bg: "--background", min: 4.5, kind: "text" },
  { fg: "--accent-foreground", bg: "--accent", min: 4.5, kind: "text" },
  { fg: "--accent-text", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--ai-text", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--success-text", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--warning-text", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--danger-text", bg: "--card", min: 4.5, kind: "text" },
  { fg: "--info-text", bg: "--card", min: 4.5, kind: "text" },
  ...TASK_STATUSES.map((s) => ({ fg: `--status-${s.replace("_", "-")}`, bg: "--card", min: 3, kind: "ui" as const })),
  ...TASK_PRIORITIES.map((p) => ({ fg: `--priority-${p}`, bg: "--card", min: 3, kind: "ui" as const })),
  { fg: "--success", bg: "--card", min: 3, kind: "ui" },
  { fg: "--danger", bg: "--card", min: 3, kind: "ui" },
  { fg: "--primary", bg: "--card", min: 3, kind: "ui" },
];

const SWATCHES = [
  "--background", "--card", "--surface-2", "--border", "--foreground", "--muted-foreground",
  "--primary", "--accent", "--ai", "--success", "--warning", "--danger", "--info",
];

function ContrastTable() {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<{ pair: Pair; ratio: number | null; fgHex: string; bgHex: string }[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const read = (v: string) => style.getPropertyValue(v).trim();
    setRows(
      PAIRS.map((pair) => {
        const fgHex = read(pair.fg);
        const bgHex = read(pair.bg);
        let ratio: number | null = null;
        try {
          ratio = contrastRatio(fgHex, bgHex);
        } catch {
          ratio = null;
        }
        return { pair, ratio, fgHex, bgHex };
      }),
    );
  }, []);

  const failing = rows.filter((r) => r.ratio === null || r.ratio < r.pair.min).length;

  return (
    <div ref={ref} className="space-y-2">
      <p className={cn("text-sm font-medium", failing ? "text-danger-text" : "text-success-text")} data-testid="contrast-summary">
        {rows.length === 0 ? "Measuring…" : failing ? `${failing} pair(s) below threshold` : `All ${rows.length} pairs pass`}
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-3 py-2 font-medium">Foreground</th>
              <th className="px-3 py-2 font-medium">Background</th>
              <th className="px-3 py-2 font-medium">Sample</th>
              <th className="px-3 py-2 text-right font-medium">Ratio</th>
              <th className="px-3 py-2 text-right font-medium">Needs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pair, ratio, fgHex, bgHex }) => {
              const ok = ratio !== null && ratio >= pair.min;
              return (
                <tr key={pair.fg + pair.bg} className="border-t">
                  <td className="px-3 py-1.5 font-tabular">{pair.fg} <span className="text-muted-foreground">{fgHex}</span></td>
                  <td className="px-3 py-1.5 font-tabular">{pair.bg} <span className="text-muted-foreground">{bgHex}</span></td>
                  <td className="px-3 py-1.5">
                    <span className="rounded px-2 py-0.5 font-medium" style={{ color: `var(${pair.fg})`, background: `var(${pair.bg})` }}>
                      {pair.kind === "text" ? "Aa text" : "■ glyph"}
                    </span>
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-tabular", ok ? "text-success-text" : "font-semibold text-danger-text")}>
                    {ratio === null ? "n/a" : ratio.toFixed(2)}
                    {ok ? "" : " ✕"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-tabular">{pair.min}:1</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThemePanel({ theme }: { theme: "light" | "dark" }) {
  return (
    <section
      aria-label={`${theme} theme`}
      className={cn(theme, "space-y-8 rounded-2xl border bg-background p-6 text-foreground")}
      data-testid={`panel-${theme}`}
    >
      <div className="flex items-center justify-between">
        <Logo />
        <Badge variant="outline" className="capitalize">{theme}</Badge>
      </div>

      <div className="space-y-2">
        <p className="text-display">Display 72</p>
        <p className="text-page-title">H1 page title 28/34</p>
        <p className="text-section">H2 section 20/28</p>
        <p className="text-card-title">H3 card title 16/24</p>
        <p>Body 14/22 — The quick brown fox jumps over the lazy dog.</p>
        <p className="text-meta text-muted-foreground">Meta 12/16 · muted</p>
        <p className="font-tabular">TS-42 · 0123456789</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {SWATCHES.map((v) => (
          <div key={v} className="space-y-1">
            <div className="h-10 rounded-lg border" style={{ background: `var(${v})` }} />
            <p className="truncate font-tabular text-[10px] text-muted-foreground">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Input placeholder" aria-label={`Sample input (${theme})`} />
        <Input aria-invalid defaultValue="Invalid value" aria-label={`Invalid input (${theme})`} />
        <div className="flex items-center gap-2 text-sm">
          <Switch defaultChecked aria-label={`Sample switch (${theme})`} /> Switch
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge className="bg-success/15 text-success-text">Healthy</Badge>
        <Badge className="bg-warning/15 text-warning-text">Due soon</Badge>
        <Badge className="bg-danger/15 text-danger-text">Overdue</Badge>
        <Badge className="bg-ai/15 text-ai-text">AI</Badge>
      </div>

      <div className="flex flex-wrap gap-4">
        {TASK_STATUSES.map((s) => (
          <StatusIcon key={s} status={s} showLabel />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {TASK_PRIORITIES.map((p) => (
          <PriorityIcon key={p} priority={p} showLabel />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <PulseRing score={null} size="md" />
        <PulseRing score={92} size="md" caption="Healthy" animated={false} />
        <PulseRing
          score={68}
          size="md"
          caption="Watch"
          animated={false}
          factors={[
            { weight: 30, subScore: 0.7, label: "Schedule" },
            { weight: 25, subScore: 0.8, label: "Overdue" },
            { weight: 20, subScore: 0.5, label: "Deadlines" },
            { weight: 15, subScore: 0.6, label: "Blocked" },
            { weight: 10, subScore: 0.9, label: "Workload" },
          ]}
        />
        <PulseRing score={47} size="sm" />
        <PulseRing score={21} size="xs" />
      </div>

      <div className="rounded-2xl border bg-card">
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to start planning milestones and tasks."
          as="h3"
        />
      </div>

      <ContrastTable />
    </section>
  );
}

export function DesignSystemShowcase() {
  return (
    <main id="main" className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Calm Signal design system</h1>
          <p className="text-sm text-muted-foreground">Development only · contrast ratios are measured live from CSS tokens.</p>
        </div>
        <ThemeToggle />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ThemePanel theme="light" />
        <ThemePanel theme="dark" />
      </div>
    </main>
  );
}
