import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { ComingSoon } from "@/components/brand/coming-soon";

export const metadata: Metadata = { title: "Workload balance" };

export default function Page() {
  return (
    <div className="rounded-2xl border bg-card">
      <ComingSoon phase={3} icon={Scale} title="Workload balance" description="Member utilisation against capacity with reassignment suggestions that reduce imbalance." />
    </div>
  );
}
