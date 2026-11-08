"use client";

import { Download, Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toCsvRow } from "@/lib/utils/csv";
import { cn } from "@/lib/utils";

export type Column<R> = { key: keyof R & string; label: string; format?: (v: R[keyof R], row: R) => string };

export const AXIS = { tick: { fill: "var(--muted-foreground)", fontSize: 11 }, tickLine: false, axisLine: { stroke: "var(--border)" } } as const;
export const GRID = { stroke: "var(--border)", vertical: false } as const;
export const TOOLTIP = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 2 },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
} as const;
export const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function download<R>(filename: string, columns: Column<R>[], rows: R[]) {
  const csv = toCsvRow(columns.map((c) => c.label)) + rows.map((r) => toCsvRow(columns.map((c) => r[c.key]))).join("");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Chart frame: title, explanation, "View as table" toggle, CSV of the exact dataset, empty state. */
export function ChartCard<R extends Record<string, unknown>>({
  title,
  description,
  columns,
  rows,
  filename,
  empty,
  legend,
  actions,
  className,
  children,
}: {
  title: string;
  description: string;
  columns: Column<R>[];
  rows: R[];
  filename: string;
  /** When set, the chart is replaced by this message (state the exact threshold). */
  empty?: string | null;
  legend?: { label: string; color: string; dashed?: boolean }[];
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col rounded-2xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={id} className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {actions}
        {!empty ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" aria-pressed={table} onClick={() => setTable((t) => !t)}>
              <Table2 className="size-3.5" aria-hidden /> {table ? "View chart" : "View as table"}
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label={`Download ${title} as CSV`} onClick={() => download(filename, columns, rows)}>
              <Download className="size-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
      {empty ? (
        <p className="mt-3 flex min-h-40 flex-1 items-center justify-center rounded-xl bg-surface-2 p-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : table ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface-2">
              <tr>{columns.map((c) => <th key={c.key} scope="col" className="px-2 py-1.5 text-left font-medium">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => <td key={c.key} className="px-2 py-1 font-tabular">{c.format ? c.format(r[c.key], r) : String(r[c.key] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {legend && legend.length > 1 ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("inline-block h-0.5 w-4", l.dashed && "border-t-2 border-dashed bg-transparent")} style={l.dashed ? { borderColor: l.color } : { background: l.color, height: 8, borderRadius: 2, width: 8 }} />
                  {l.label}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 h-60 w-full" role="figure" aria-label={`${title} chart. Use “View as table” for the values.`}>
            {children}
          </div>
        </>
      )}
    </section>
  );
}
