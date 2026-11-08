import type { Metadata } from "next";
import { GitBranch } from "lucide-react";
import { ComingSoon } from "@/components/brand/coming-soon";

export const metadata: Metadata = { title: "Dependency Map" };

export default function Page() {
  return (
    <div className="rounded-2xl border bg-card">
      <ComingSoon phase={3} icon={GitBranch} title="Dependency Map" description="Link tasks that block each other, prevent cycles and see the longest open chain." />
    </div>
  );
}
