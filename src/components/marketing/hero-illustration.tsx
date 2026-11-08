import { PulseRing } from "@/components/brand/pulse-ring";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { StatusIcon } from "@/components/brand/status-icon";
import type { TaskPriority, TaskStatus } from "@/lib/domain";

type Card = { key: string; title: string; priority: TaskPriority };
const COLUMNS: { status: TaskStatus; cards: Card[] }[] = [
  {
    status: "todo",
    cards: [
      { key: "TS-12", title: "Draft survey questions", priority: "medium" },
      { key: "TS-15", title: "Book lab slot for testing", priority: "low" },
    ],
  },
  {
    status: "in_progress",
    cards: [
      { key: "TS-9", title: "Build login screen", priority: "high" },
      { key: "TS-11", title: "Literature review notes", priority: "urgent" },
    ],
  },
  {
    status: "done",
    cards: [{ key: "TS-4", title: "Choose project topic", priority: "none" }],
  },
];

/**
 * Decorative product composition for the hero, built from real components. It shows sample card
 * titles only — no numbers presented as user metrics — and is hidden from assistive tech.
 */
export function HeroIllustration() {
  return (
    <figure className="relative mx-auto w-full max-w-3xl">
      <div
        aria-hidden="true"
        className="elev-3 overflow-hidden rounded-2xl border bg-card [transform:perspective(1600px)_rotateX(6deg)_rotateY(-6deg)] motion-reduce:transform-none"
      >
        <div className="flex items-center gap-2 border-b bg-surface-2 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-background/80" />
        </div>
        <div className="flex gap-4 p-4">
          <div className="hidden w-40 shrink-0 flex-col items-center gap-3 rounded-xl bg-surface-2 p-4 sm:flex">
            <PulseRing
              score={74}
              size="md"
              animated={false}
              factors={[
                { weight: 30, subScore: 0.8, label: "Schedule" },
                { weight: 25, subScore: 0.7, label: "Overdue" },
                { weight: 20, subScore: 0.75, label: "Deadlines" },
                { weight: 15, subScore: 0.6, label: "Blocked" },
                { weight: 10, subScore: 0.8, label: "Workload" },
              ]}
            />
            <span className="text-xs text-muted-foreground">Pulse</span>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3">
            {COLUMNS.map((col) => (
              <div key={col.status} className="min-w-0 space-y-2 rounded-xl bg-surface-2 p-2">
                <StatusIcon status={col.status} showLabel className="px-1 text-xs font-medium" />
                {col.cards.map((c) => (
                  <div key={c.key} className="space-y-1.5 rounded-lg border bg-card p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-tabular text-[10px] text-muted-foreground">{c.key}</span>
                      <PriorityIcon priority={c.priority} />
                    </div>
                    <p className="truncate text-xs font-medium">{c.title}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Illustration
      </figcaption>
    </figure>
  );
}
