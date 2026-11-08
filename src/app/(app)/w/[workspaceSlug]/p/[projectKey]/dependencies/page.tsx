import type { Metadata } from "next";
import { DependencyMap } from "@/components/deps/dependency-map";

export const metadata: Metadata = { title: "Dependencies" };

export default function DependenciesPage() {
  return <DependencyMap />;
}
