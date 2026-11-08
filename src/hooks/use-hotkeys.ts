"use client";

import { useEffect, useRef } from "react";

export type Hotkey = {
  /** e.g. "mod+k", "?", "/", "c", "g b" (sequence) */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Fire even when focus is in an input/textarea/contenteditable */
  allowInInputs?: boolean;
};

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    el.getAttribute?.("role") === "combobox"
  );
}

export function matchesCombo(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const wantsMod = parts.includes("mod");
  const hasMod = e.metaKey || e.ctrlKey;
  if (wantsMod !== hasMod) return false;
  if (!wantsMod && (e.metaKey || e.ctrlKey || e.altKey)) return false;
  return e.key.toLowerCase() === key;
}

/** Global keyboard shortcuts with optional two-key sequences ("g b"). */
export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
  const ref = useRef(hotkeys);
  useEffect(() => {
    ref.current = hotkeys;
  });

  useEffect(() => {
    if (!enabled) return;
    let pending: string | null = null;
    let timer: number | undefined;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = isTypingTarget(e.target);
      for (const hk of ref.current) {
        if (typing && !hk.allowInInputs) continue;
        const seq = hk.combo.split(" ");
        if (seq.length === 2) {
          if (pending === seq[0] && matchesCombo(e, seq[1]!)) {
            e.preventDefault();
            pending = null;
            hk.handler(e);
            return;
          }
          continue;
        }
        if (matchesCombo(e, hk.combo)) {
          e.preventDefault();
          hk.handler(e);
          return;
        }
      }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
        const k = e.key.toLowerCase();
        if (ref.current.some((hk) => hk.combo.split(" ").length === 2 && hk.combo.startsWith(`${k} `))) {
          pending = k;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => (pending = null), 900);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [enabled]);
}
