/**
 * Landing-page "Try the Pulse formula" demo (PHASE_1 Step 10). A simplified, pure version of the
 * Project Pulse formula (spec §G.1) driven by shares the visitor enters with sliders — it never
 * reads real project data. The full algorithm arrives in Phase 3 (`pulse.ts`).
 */
export type PulseBand = "healthy" | "watch" | "at_risk" | "critical";

export type PulseDemoInput = {
  /** Share of effort done, 0–1 */
  completion: number;
  /** Share of the timeline elapsed, 0–1 */
  timelineElapsed: number;
  /** Share of open (weighted) effort that is overdue, 0–1 */
  overdueShare: number;
  /** Share of due-soon effort not yet started, 0–1 */
  dueSoonNotStartedShare: number;
  /** Share of open effort that is blocked, 0–1 */
  blockedShare: number;
  /** Workload imbalance index, 0–1 */
  workloadImbalance: number;
};

export type PulseFactorKey = "schedule" | "overdue" | "deadline" | "blocked" | "workload";

export type PulseDemoFactor = {
  key: PulseFactorKey;
  label: string;
  weight: number;
  subScore: number;
  points: number;
  lostPoints: number;
};

export type PulseDemoResult = {
  score: number;
  band: PulseBand;
  factors: PulseDemoFactor[];
  topReason: string;
};

export const PULSE_WEIGHTS: Record<PulseFactorKey, number> = {
  schedule: 30,
  overdue: 25,
  deadline: 20,
  blocked: 15,
  workload: 10,
};

export const PULSE_LABELS: Record<PulseFactorKey, string> = {
  schedule: "Completion vs schedule",
  overdue: "Overdue pressure",
  deadline: "Deadline readiness",
  blocked: "Blocked work",
  workload: "Workload balance",
};

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function bandFor(score: number): PulseBand {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 40) return "at_risk";
  return "critical";
}

export const BAND_LABELS: Record<PulseBand, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
  critical: "Critical",
};

const REASONS: Record<PulseFactorKey, (input: PulseDemoInput) => string> = {
  schedule: (i) =>
    `${pct(i.completion)} done vs ${pct(i.timelineElapsed)} of the timeline elapsed`,
  overdue: (i) => `${pct(i.overdueShare)} of open work is overdue`,
  deadline: (i) => `${pct(i.dueSoonNotStartedShare)} of work due in 3 days hasn't started`,
  blocked: (i) => `${pct(i.blockedShare)} of open work is blocked`,
  workload: (i) => `Workload imbalance is ${i.workloadImbalance.toFixed(2)} (0 = even)`,
};

function pct(n: number): string {
  return `${Math.round(clamp01(n) * 100)}%`;
}

export function computePulseDemo(raw: PulseDemoInput): PulseDemoResult {
  const input: PulseDemoInput = {
    completion: clamp01(raw.completion),
    timelineElapsed: clamp01(raw.timelineElapsed),
    overdueShare: clamp01(raw.overdueShare),
    dueSoonNotStartedShare: clamp01(raw.dueSoonNotStartedShare),
    blockedShare: clamp01(raw.blockedShare),
    workloadImbalance: clamp01(raw.workloadImbalance),
  };

  const expected = Math.max(input.timelineElapsed, 0.05);
  const sub: Record<PulseFactorKey, number> = {
    schedule: clamp01(input.completion / expected),
    overdue: 1 - input.overdueShare,
    deadline: 1 - input.dueSoonNotStartedShare,
    blocked: 1 - input.blockedShare,
    workload: 1 - input.workloadImbalance,
  };

  const factors: PulseDemoFactor[] = (Object.keys(PULSE_WEIGHTS) as PulseFactorKey[]).map((key) => {
    const weight = PULSE_WEIGHTS[key];
    const subScore = sub[key];
    return {
      key,
      label: PULSE_LABELS[key],
      weight,
      subScore,
      points: weight * subScore,
      lostPoints: weight * (1 - subScore),
    };
  });

  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
  const worst = [...factors].sort((a, b) => b.lostPoints - a.lostPoints)[0];
  const topReason =
    worst && worst.lostPoints >= 2 ? REASONS[worst.key](input) : "Everything looks on track";

  return { score, band: bandFor(score), factors, topReason };
}
