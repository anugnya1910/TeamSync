import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsCard({
  title,
  description,
  children,
  footer,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      aria-label={title}
      className={cn("overflow-hidden rounded-2xl border bg-card", tone === "danger" && "border-danger/40")}
    >
      <div className="space-y-1 border-b px-5 py-4">
        <h2 className={cn("text-card-title", tone === "danger" && "text-danger-text")}>{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t bg-surface-2/50 px-5 py-3">{footer}</div> : null}
    </section>
  );
}
