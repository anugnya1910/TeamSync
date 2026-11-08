import { describe, expect, it } from "vitest";
import {
  bandFor,
  computePulseDemo,
  PULSE_WEIGHTS,
  type PulseDemoInput,
} from "@/lib/algorithms/pulse-demo";

const base: PulseDemoInput = {
  completion: 0.5,
  timelineElapsed: 0.5,
  overdueShare: 0.1,
  dueSoonNotStartedShare: 0.2,
  blockedShare: 0.1,
  workloadImbalance: 0.2,
};

describe("computePulseDemo", () => {
  it("weights sum to 100", () => {
    expect(Object.values(PULSE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("perfect project scores 100 and is healthy", () => {
    const r = computePulseDemo({
      completion: 1,
      timelineElapsed: 1,
      overdueShare: 0,
      dueSoonNotStartedShare: 0,
      blockedShare: 0,
      workloadImbalance: 0,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("healthy");
    expect(r.topReason).toBe("Everything looks on track");
  });

  it("worst case scores 0 and is critical", () => {
    const r = computePulseDemo({
      completion: 0,
      timelineElapsed: 1,
      overdueShare: 1,
      dueSoonNotStartedShare: 1,
      blockedShare: 1,
      workloadImbalance: 1,
    });
    expect(r.score).toBe(0);
    expect(r.band).toBe("critical");
  });

  it("score stays within 0–100 for out-of-range and NaN inputs", () => {
    const r = computePulseDemo({
      completion: 7,
      timelineElapsed: -3,
      overdueShare: Number.NaN,
      dueSoonNotStartedShare: 2,
      blockedShare: -1,
      workloadImbalance: Infinity,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("factor points sum to the score (± rounding) — explainability guarantee", () => {
    for (let i = 0; i < 200; i++) {
      const input: PulseDemoInput = {
        completion: Math.random(),
        timelineElapsed: Math.random(),
        overdueShare: Math.random(),
        dueSoonNotStartedShare: Math.random(),
        blockedShare: Math.random(),
        workloadImbalance: Math.random(),
      };
      const r = computePulseDemo(input);
      const sum = r.factors.reduce((s, f) => s + f.points, 0);
      expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(0.5);
    }
  });

  it("increasing overdue share never increases the score (monotonicity)", () => {
    let prev = Infinity;
    for (let o = 0; o <= 1.0001; o += 0.05) {
      const s = computePulseDemo({ ...base, overdueShare: o }).score;
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });

  it("increasing blocked share or imbalance never increases the score", () => {
    for (const key of ["blockedShare", "workloadImbalance", "dueSoonNotStartedShare"] as const) {
      let prev = Infinity;
      for (let v = 0; v <= 1.0001; v += 0.1) {
        const s = computePulseDemo({ ...base, [key]: v }).score;
        expect(s).toBeLessThanOrEqual(prev);
        prev = s;
      }
    }
  });

  it("being ahead of schedule caps the schedule factor at 1", () => {
    const r = computePulseDemo({ ...base, completion: 0.9, timelineElapsed: 0.2 });
    expect(r.factors.find((f) => f.key === "schedule")?.subScore).toBe(1);
  });

  it("names the factor losing the most points as the top reason", () => {
    const r = computePulseDemo({ ...base, overdueShare: 0.9 });
    expect(r.topReason).toMatch(/overdue/i);
  });
});

describe("bandFor", () => {
  it.each([
    [100, "healthy"],
    [80, "healthy"],
    [79, "watch"],
    [60, "watch"],
    [59, "at_risk"],
    [40, "at_risk"],
    [39, "critical"],
    [0, "critical"],
  ])("%i → %s", (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});
