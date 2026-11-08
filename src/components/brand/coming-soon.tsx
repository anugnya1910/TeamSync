import { Sparkles, type LucideIcon } from "lucide-react";
import { EmptyState, type EmptyStateAction } from "./empty-state";
import { Badge } from "@/components/ui/badge";

type ComingSoonProps = {
  phase: 2 | 3 | 4;
  title: string;
  description: string;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

/** Explained placeholder for a feature that ships in a later phase — never a dead link. */
export function ComingSoon({
  phase,
  title,
  description,
  icon = Sparkles,
  backHref,
  backLabel = "Back to dashboard",
  className,
}: ComingSoonProps) {
  const back: EmptyStateAction | undefined = backHref ? { label: backLabel, href: backHref } : undefined;
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      primaryAction={back}
      className={className}
    >
      <Badge variant="outline" className="font-medium">
        Coming in Phase {phase}
      </Badge>
    </EmptyState>
  );
}
