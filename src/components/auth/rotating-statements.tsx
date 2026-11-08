"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useReducedMotionPreference } from "@/lib/motion";

const STATEMENTS = [
  { title: "Explainable health", body: "Project Pulse turns your tasks into a 0–100 score — and tells you exactly why." },
  { title: "Balanced teams", body: "See who's overloaded before it hurts, and move work with one click." },
  { title: "Live together", body: "Boards, comments and notifications update in real time for everyone." },
];

export function RotatingStatements() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % STATEMENTS.length), 5000);
    return () => window.clearInterval(id);
  }, [reduced]);

  const s = STATEMENTS[index] ?? STATEMENTS[0]!;
  return (
    <div className="min-h-32" aria-live="off">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ duration: reduced ? 0.1 : 0.4 }}
        >
          <p className="font-display text-3xl font-semibold tracking-tight">{s.title}</p>
          <p className="mt-3 max-w-sm text-base text-foreground/80">{s.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex gap-1.5" aria-hidden>
        {STATEMENTS.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all ${i === index ? "w-6 bg-foreground/80" : "w-2 bg-foreground/25"}`}
          />
        ))}
      </div>
    </div>
  );
}
