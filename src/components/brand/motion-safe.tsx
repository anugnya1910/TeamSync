"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { durations, easing, useReducedMotionPreference } from "@/lib/motion";

type MotionSafeProps = HTMLMotionProps<"div"> & { delay?: number; y?: number };

/** Fade/slide-in wrapper that degrades to a short fade under reduced motion (spec §F.6). */
export function MotionSafe({ delay = 0, y = 8, children, ...rest }: MotionSafeProps) {
  const reduced = useReducedMotionPreference();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: durations.reducedFade }
          : { duration: durations.sheet, ease: easing, delay }
      }
      {...rest}
    >
      {children}
    </motion.div>
  );
}
