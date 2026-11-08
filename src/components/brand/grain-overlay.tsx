import { cn } from "@/lib/utils";

/**
 * 2% film-grain texture — landing hero and auth panels only (spec §F.1). Uses a small
 * pre-rendered noise tile (public/noise.png, see scripts/generate-noise.mjs) instead of an SVG
 * feTurbulence filter, which is expensive to paint over large areas on low-end devices.
 */
export function GrainOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ backgroundImage: "url(/noise.png)", backgroundSize: "128px 128px", opacity: "var(--grain-opacity)" }}
    />
  );
}
