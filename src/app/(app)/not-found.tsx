import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";

export default function AppNotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={SearchX}
        as="h1"
        title="We couldn't find that"
        description="This page doesn't exist, or you don't have access to it."
        primaryAction={{ label: "Back to dashboard", href: "/app" }}
      />
    </main>
  );
}
