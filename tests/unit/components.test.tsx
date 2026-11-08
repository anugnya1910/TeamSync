import { render, screen } from "@testing-library/react";
import { FolderKanban } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ComingSoon } from "@/components/brand/coming-soon";
import { EmptyState } from "@/components/brand/empty-state";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { PulseRing } from "@/components/brand/pulse-ring";
import { StatusIcon } from "@/components/brand/status-icon";

describe("PulseRing", () => {
  it("renders the null state with an accessible label", () => {
    render(<PulseRing score={null} />);
    expect(screen.getByRole("img", { name: /not enough data/i })).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the score and band in its accessible name", () => {
    render(<PulseRing score={72.4} />);
    expect(screen.getByRole("img", { name: "Project Pulse 72 out of 100 — Watch" })).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("clamps out-of-range scores", () => {
    render(<PulseRing score={140} />);
    expect(screen.getByRole("img", { name: /100 out of 100 — Healthy/ })).toBeInTheDocument();
  });

  it("draws one segment pair per factor", () => {
    const { container } = render(
      <PulseRing
        score={50}
        factors={[
          { weight: 30, subScore: 0.5, label: "A" },
          { weight: 20, subScore: 1, label: "B" },
          { weight: 10, subScore: 0, label: "C" },
        ]}
      />,
    );
    expect(container.querySelectorAll("svg circle")).toHaveLength(6);
  });
});

describe("EmptyState", () => {
  it("renders title, description and link actions", () => {
    render(
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Create one to get started."
        primaryAction={{ label: "Create project", href: "/new" }}
        secondaryAction={{ label: "Learn more", href: "/docs" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "No projects yet" })).toBeInTheDocument();
    expect(screen.getByText("Create one to get started.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create project" })).toHaveAttribute("href", "/new");
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/docs");
  });

  it("ComingSoon names the phase", () => {
    render(<ComingSoon phase={3} title="Analytics" description="Charts from real data." />);
    expect(screen.getByText("Coming in Phase 3")).toBeInTheDocument();
  });
});

describe("Status & priority icons", () => {
  it("expose labels so colour is never the only signal", () => {
    render(
      <>
        <StatusIcon status="in_review" />
        <PriorityIcon priority="urgent" />
        <StatusIcon status="done" showLabel />
      </>,
    );
    expect(screen.getByRole("img", { name: "In review" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Priority: Urgent" })).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});
