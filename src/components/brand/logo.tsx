import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Show the "TeamSync" wordmark next to the mark */
  withWordmark?: boolean;
  /** Accessible label; set to null when the logo is purely decorative next to text */
  label?: string | null;
};

/**
 * TeamSync mark: two interlocking arcs forming an S-like sync loop. The upper arc uses
 * `currentColor`, the lower arc the Pulse Coral accent, meeting at a centre "beat" dot.
 */
export function LogoMark({ className, label = "TeamSync" }: Omit<LogoProps, "withWordmark">) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      fill="none"
    >
      <path
        d="M22.5 9.2A8.5 8.5 0 0 0 7.6 13.4"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M7.6 13.4c0 2.6 2.1 4.6 8.4 4.6"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 22.8a8.5 8.5 0 0 0 14.9-4.2"
        stroke="var(--accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M24.4 18.6c0-2.6-2.1-4.6-8.4-4.6"
        stroke="var(--accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M22.5 9.2l1.6-3.4M22.5 9.2l-3.6.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9.5 22.8l-1.6 3.4M9.5 22.8l3.6-.6" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.9" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className, withWordmark = true, label = "TeamSync" }: LogoProps) {
  if (!withWordmark) return <LogoMark className={className} label={label} />;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark label={null} />
      <span className="font-display text-lg font-bold tracking-tight">
        Team<span className="text-accent-text">Sync</span>
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
