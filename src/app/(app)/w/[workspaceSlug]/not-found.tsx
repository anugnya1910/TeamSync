import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";

export default function WorkspaceNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      as="h1"
      title="We couldn't find that"
      description="This page doesn't exist, or you don't have access to it."
      primaryAction={{ label: "Back to dashboard", href: "/app" }}
    />
  );
}
