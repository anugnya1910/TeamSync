"use client";

import { useReducedMotion } from "framer-motion";
import { createContext, useContext } from "react";

/** Motion tokens (spec §F.6). Durations in seconds for Framer Motion. */
export const durations = {
  press: 0.12,
  popover: 0.2,
  sheet: 0.28,
  pulseFill: 0.6,
  reducedFade: 0.1,
} as const;

export const easing = [0.2, 0.8, 0.2, 1] as const;
export const easingCss = "cubic-bezier(.2,.8,.2,1)";

/** Profile-level reduced-motion preference, provided by the app shell once the profile loads. */
export const ProfileReducedMotionContext = createContext<boolean>(false);

/** True when the OS prefers reduced motion OR the user enabled it in their profile. */
export function useReducedMotionPreference(): boolean {
  const system = useReducedMotion();
  const profile = useContext(ProfileReducedMotionContext);
  return Boolean(system) || profile;
}

/** Transition helper that collapses to a short fade under reduced motion. */
export function motionTransition(reduced: boolean, duration: number = durations.popover) {
  return reduced
    ? { duration: durations.reducedFade, ease: "linear" as const }
    : { duration, ease: easing };
}
