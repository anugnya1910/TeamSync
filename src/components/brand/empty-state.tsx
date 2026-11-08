import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type EmptyStateProps = {
  icon?: LucideIcon;
  illustration?: ReactNode;
  title: string;
  description?: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
  /** Heading level for the title (defaults to h2) */
  as?: "h1" | "h2" | "h3";
  compact?: boolean;
};

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: "default" | "outline" }) {
  if (action.href) {
    return (
      <Button asChild variant={variant} size="lg">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} size="lg" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/** Every empty state teaches the next action (spec §F.1 "Explain everything"). */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className,
  as: Heading = "h2",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      {illustration ??
        (Icon ? (
          <div
            className={cn(
              "grid place-items-center rounded-2xl border bg-surface-2 text-muted-foreground",
              compact ? "size-10" : "size-14",
            )}
          >
            <Icon className={compact ? "size-5" : "size-6"} aria-hidden />
          </div>
        ) : null)}
      <Heading className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-card-title")}>
        {title}
      </Heading>
      {description ? (
        <div className={cn("max-w-md text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {description}
        </div>
      ) : null}
      {children}
      {primaryAction || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? <ActionButton action={primaryAction} variant="default" /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} variant="outline" /> : null}
        </div>
      ) : null}
    </div>
  );
}
