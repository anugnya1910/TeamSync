import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={SearchX}
        as="h1"
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        primaryAction={{ label: "Go home", href: "/" }}
      />
    </main>
  );
}
