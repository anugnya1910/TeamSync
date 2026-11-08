import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/brand/coming-soon";

export const metadata: Metadata = { title: "Project analytics" };

export default function Page() {
  return (
    <div className="rounded-2xl border bg-card">
      <ComingSoon phase={3} icon={BarChart3} title="Project analytics" description="Burndown, throughput, cycle time and contribution charts computed from this project's real history." />
    </div>
  );
}
