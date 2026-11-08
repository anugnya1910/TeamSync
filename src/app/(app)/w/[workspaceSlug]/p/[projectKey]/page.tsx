import type { Metadata } from "next";
import { ProjectOverview } from "@/components/project/project-overview";

export const metadata: Metadata = { title: "Project" };

export default function ProjectOverviewPage() {
  return <ProjectOverview />;
}
