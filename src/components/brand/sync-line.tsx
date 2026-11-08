"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SyncLineContextValue = { trigger: () => void; pulseKey: number };

const SyncLineContext = createContext<SyncLineContextValue>({ trigger: () => {}, pulseKey: 0 });

/** Provides `trigger()` so realtime handlers (Phase 2) can sweep the Sync Line. */
export function SyncLineProvider({ children }: { children: ReactNode }) {
  const [pulseKey, setPulseKey] = useState(0);
  const trigger = useCallback(() => setPulseKey((k) => k + 1), []);
  const value = useMemo(() => ({ trigger, pulseKey }), [trigger, pulseKey]);
  return <SyncLineContext value={value}>{children}</SyncLineContext>;
}

export function useSyncLine() {
  return useContext(SyncLineContext);
}

/** 2px gradient line at the very top of the app shell (spec §F.1). */
export function SyncLine({ className }: { className?: string }) {
  const { pulseKey } = useSyncLine();
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none relative h-0.5 w-full overflow-hidden", className)}
      style={{
        background:
          "linear-gradient(90deg, color-mix(in oklab, var(--primary) 70%, transparent), color-mix(in oklab, var(--accent) 70%, transparent))",
      }}
    >
      {pulseKey > 0 ? (
        <span
          key={pulseKey}
          className="absolute inset-0 motion-safe:animate-sync-sweep"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent 0%, var(--background) 45%, var(--accent) 50%, var(--background) 55%, transparent 100%)",
            backgroundSize: "50% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : null}
    </div>
  );
}
