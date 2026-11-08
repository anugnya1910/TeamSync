import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/domain";
import { initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/** Named colour tokens used for projects, teams and labels (light/dark safe mid-tones). */
export const TOKEN_COLORS: Record<string, string> = {
  indigo: "#6366F1",
  coral: "#FF6A4D",
  violet: "#8B5CF6",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  sky: "#0EA5E9",
  slate: "#64748B",
};
export const tokenColor = (c: string | null | undefined) => TOKEN_COLORS[c ?? ""] ?? TOKEN_COLORS.indigo!;

export function ColorDot({ color, className }: { color: string | null | undefined; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: tokenColor(color) }} />;
}

export function UserAvatar({
  name,
  url,
  className,
  title,
}: {
  name: string;
  url?: string | null;
  className?: string;
  title?: boolean;
}) {
  const av = (
    <Avatar className={cn("size-6 border border-background", className)}>
      {url ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback className="text-[10px] font-semibold">{initials(name)}</AvatarFallback>
    </Avatar>
  );
  if (!title) return av;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={name} className="rounded-full">
          {av}
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = "size-6",
  label,
}: {
  people: { id: string; name: string; url: string | null }[];
  max?: number;
  size?: string;
  label?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5" aria-label={label ?? people.map((p) => p.name).join(", ")} role="img">
      {shown.map((p) => (
        <UserAvatar key={p.id} name={p.name} url={p.url} className={size} />
      ))}
      {extra > 0 ? (
        <span className={cn("grid place-items-center rounded-full border border-background bg-surface-2 text-[10px] font-semibold", size)}>
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  planning: "border-info/50 text-info-text",
  active: "border-success/50 text-success-text",
  on_hold: "border-warning/60 text-warning-text",
  completed: "border-primary/50 text-primary",
  archived: "border-border text-muted-foreground",
};

export function ProjectStatusPill({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status], className)}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

export function ProjectIcon({ icon, color, name, className }: { icon: string | null; color: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-base font-bold text-white", className)}
      style={{ background: tokenColor(color) }}
    >
      {icon || name.trim()[0]?.toUpperCase()}
    </span>
  );
}
