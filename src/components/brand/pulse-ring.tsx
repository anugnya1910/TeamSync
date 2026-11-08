import { cn } from "@/lib/utils";
import { BAND_LABELS, bandFor, type PulseBand } from "@/lib/algorithms/pulse-demo";

export type PulseRingFactor = { weight: number; subScore: number; label: string };

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const SIZES: Record<Size, { px: number; stroke: number; text: string; sub: string }> = {
  xs: { px: 32, stroke: 3.5, text: "text-[10px]", sub: "hidden" },
  sm: { px: 48, stroke: 4, text: "text-sm", sub: "hidden" },
  md: { px: 96, stroke: 7, text: "text-2xl", sub: "text-[10px]" },
  lg: { px: 160, stroke: 10, text: "text-5xl", sub: "text-xs" },
  xl: { px: 220, stroke: 13, text: "text-6xl", sub: "text-sm" },
};

export const BAND_COLOR: Record<PulseBand, string> = {
  healthy: "var(--success)",
  watch: "var(--info)",
  at_risk: "var(--warning)",
  critical: "var(--danger)",
};

type PulseRingProps = {
  score: number | null;
  factors?: PulseRingFactor[];
  size?: Size;
  animated?: boolean;
  className?: string;
  /** Visible caption under the number (md+ only) */
  caption?: string;
};

/**
 * Pulse Ring (spec §F.1): a segmented gauge where each arc is one Pulse factor — segment length
 * ∝ weight, filled portion ∝ sub-score. The centre shows the score with a heartbeat (disabled
 * under reduced motion via CSS). `score = null` renders a dashed ring meaning "Not enough data".
 */
export function PulseRing({
  score,
  factors,
  size = "md",
  animated = true,
  className,
  caption,
}: PulseRingProps) {
  const s = SIZES[size];
  const r = (s.px - s.stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = s.px / 2;

  if (score === null || !Number.isFinite(score)) {
    return (
      <div
        role="img"
        aria-label="Project Pulse: Not enough data"
        className={cn("relative inline-grid shrink-0 place-items-center", className)}
        style={{ width: s.px, height: s.px }}
      >
        <svg width={s.px} height={s.px} aria-hidden>
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.5}
            strokeWidth={Math.max(2, s.stroke * 0.5)}
            strokeDasharray={`${Math.max(3, s.stroke)} ${Math.max(4, s.stroke * 1.2)}`}
          />
        </svg>
        <span className={cn("absolute font-display font-semibold text-muted-foreground", s.text)}>
          —
        </span>
      </div>
    );
  }

  const value = Math.max(0, Math.min(100, Math.round(score)));
  const band = bandFor(value);
  const color = BAND_COLOR[band];
  const segments = normaliseFactors(factors, value);
  const gap = segments.length > 1 ? Math.min(c * 0.012 + s.stroke * 0.6, c / (segments.length * 4)) : 0;
  const totalWeight = segments.reduce((sum, f) => sum + f.weight, 0) || 1;

  const arcs = segments.reduce<{ start: number; len: number; filled: number; label: string }[]>(
    (acc, f) => {
      const prev = acc[acc.length - 1];
      const start = prev ? prev.start + prev.len + gap : 0;
      const len = Math.max(0, (f.weight / totalWeight) * c - gap);
      const filled = Math.max(0, Math.min(1, f.subScore)) * len;
      acc.push({ start, len, filled, label: f.label });
      return acc;
    },
    [],
  );

  return (
    <div
      role="img"
      aria-label={`Project Pulse ${value} out of 100 — ${BAND_LABELS[band]}`}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: s.px, height: s.px }}
    >
      <svg width={s.px} height={s.px} className="-rotate-90" aria-hidden>
        {arcs.map((a, i) => (
          <g key={i}>
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth={s.stroke}
              strokeLinecap="butt"
              strokeDasharray={`${a.len} ${c - a.len}`}
              strokeDashoffset={-a.start}
            />
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={s.stroke}
              strokeLinecap="butt"
              strokeDasharray={`${a.filled} ${c - a.filled}`}
              strokeDashoffset={-a.start}
              className="transition-[stroke-dasharray] duration-600 ease-[cubic-bezier(.2,.8,.2,1)]"
            >
              <title>{a.label}</title>
            </circle>
          </g>
        ))}
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center",
          animated && "motion-safe:animate-heartbeat",
        )}
      >
        <span className="flex flex-col items-center leading-none">
          <span className={cn("font-display font-bold tabular-nums", s.text)} style={{ color }}>
            {value}
          </span>
          {caption && s.sub !== "hidden" ? (
            <span className={cn("mt-1 font-medium text-muted-foreground", s.sub)}>{caption}</span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

function normaliseFactors(factors: PulseRingFactor[] | undefined, score: number): PulseRingFactor[] {
  const valid = (factors ?? []).filter((f) => Number.isFinite(f.weight) && f.weight > 0);
  if (valid.length > 0) return valid;
  return [{ weight: 1, subScore: score / 100, label: "Pulse" }];
}
