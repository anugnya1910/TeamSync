import { cn } from "@/lib/utils";

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

/** 2% film-grain texture — landing hero and auth panels only (spec §F.1). */
export function GrainOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 mix-blend-multiply dark:mix-blend-screen", className)}
      style={{ backgroundImage: NOISE, opacity: "var(--grain-opacity)" }}
    />
  );
}
