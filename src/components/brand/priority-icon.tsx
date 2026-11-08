import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, type TaskPriority } from "@/lib/domain";

const COLOR: Record<TaskPriority, string> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
  none: "var(--priority-none)",
};

const BARS: Record<Exclude<TaskPriority, "urgent" | "none">, number> = { high: 3, medium: 2, low: 1 };

/** Priority glyph (spec §F.2): urgent = filled square with "!", high/medium/low = 3/2/1 bars, none = dashed. */
function Glyph({ priority }: { priority: TaskPriority }) {
  if (priority === "urgent") {
    return (
      <>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" />
        <path d="M8 4.5v4.3" stroke="var(--background)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="1.1" fill="var(--background)" />
      </>
    );
  }
  if (priority === "none") {
    return (
      <path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 2" strokeLinecap="round" />
    );
  }
  const active = BARS[priority];
  return (
    <>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4.5}
          y={10 - i * 3.5}
          width="3"
          height={4 + i * 3.5}
          rx="1"
          fill="currentColor"
          opacity={i < active ? 1 : 0.22}
        />
      ))}
    </>
  );
}

type Props = { priority: TaskPriority; showLabel?: boolean; className?: string };

export function PriorityIcon({ priority, showLabel = false, className }: Props) {
  const label = PRIORITY_LABELS[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} style={{ color: COLOR[priority] }}>
      <svg
        viewBox="0 0 16 16"
        className="size-4 shrink-0"
        role={showLabel ? undefined : "img"}
        aria-label={showLabel ? undefined : `Priority: ${label}`}
        aria-hidden={showLabel ? true : undefined}
      >
        <Glyph priority={priority} />
      </svg>
      {showLabel ? <span className="text-foreground">{label}</span> : null}
    </span>
  );
}
