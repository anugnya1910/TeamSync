import { cn } from "@/lib/utils";
import { STATUS_LABELS, type TaskStatus } from "@/lib/domain";

const COLOR: Record<TaskStatus, string> = {
  backlog: "var(--status-backlog)",
  todo: "var(--status-todo)",
  in_progress: "var(--status-in-progress)",
  in_review: "var(--status-in-review)",
  done: "var(--status-done)",
  cancelled: "var(--status-cancelled)",
};

/** Status glyph: each status has a distinct SHAPE as well as colour (never colour alone). */
function Glyph({ status }: { status: TaskStatus }) {
  const common = { fill: "none", strokeWidth: 1.8 } as const;
  switch (status) {
    case "backlog":
      return <circle cx="8" cy="8" r="6" stroke="currentColor" strokeDasharray="2.2 2.2" {...common} />;
    case "todo":
      return <circle cx="8" cy="8" r="6" stroke="currentColor" {...common} />;
    case "in_progress":
      return (
        <>
          <circle cx="8" cy="8" r="6" stroke="currentColor" {...common} />
          <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
        </>
      );
    case "in_review":
      return (
        <>
          <circle cx="8" cy="8" r="6" stroke="currentColor" {...common} />
          <path d="M8 4a4 4 0 1 1-4 4h4z" fill="currentColor" />
        </>
      );
    case "done":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8.2l2 2 4-4.2" stroke="var(--background)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "cancelled":
      return (
        <>
          <circle cx="8" cy="8" r="6" stroke="currentColor" {...common} />
          <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
  }
}

type Props = { status: TaskStatus; showLabel?: boolean; className?: string };

export function StatusIcon({ status, showLabel = false, className }: Props) {
  const label = STATUS_LABELS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} style={{ color: COLOR[status] }}>
      <svg
        viewBox="0 0 16 16"
        className="size-4 shrink-0"
        role={showLabel ? undefined : "img"}
        aria-label={showLabel ? undefined : label}
        aria-hidden={showLabel ? true : undefined}
      >
        <Glyph status={status} />
      </svg>
      {showLabel ? (
        <span className={cn("text-foreground", status === "cancelled" && "text-muted-foreground line-through")}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
