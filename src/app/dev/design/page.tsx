import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignSystemShowcase } from "@/components/dev/design-system-showcase";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

/** Development-only design system page (PHASE_1 Step 2.7). Not rendered in production. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production" && process.env.TEAMSYNC_ENABLE_DEV_PAGES !== "true") {
    notFound();
  }
  return <DesignSystemShowcase />;
}
