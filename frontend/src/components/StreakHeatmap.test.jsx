import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StreakHeatmap from "./StreakHeatmap";

function history(counts) {
  return counts.map((completed_count, index) => ({
    day: `2026-05-${String(index + 1).padStart(2, "0")}`,
    completed_count,
  }));
}

describe("StreakHeatmap", () => {
  it("renders nothing without history", () => {
    const { container } = render(<StreakHeatmap history={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one cell per day", () => {
    const { container } = render(<StreakHeatmap history={history([0, 1, 2, 0, 3, 1, 0])} />);

    expect(container.querySelectorAll(".heatmap-day")).toHaveLength(7);
  });

  it("groups days into weeks", () => {
    const { container } = render(<StreakHeatmap history={history(Array(14).fill(1))} />);

    expect(container.querySelectorAll(".heatmap-week")).toHaveLength(2);
  });

  it("leaves a quiet day at intensity zero", () => {
    const { container } = render(<StreakHeatmap history={history([0, 4])} />);

    expect(container.querySelectorAll(".heatmap-day")[0]).toHaveAttribute("data-intensity", "0");
  });

  it("never rounds an active day down to nothing", () => {
    // One task on a day where somebody else did twenty must still read as
    // "something happened", not as an empty square.
    const { container } = render(<StreakHeatmap history={history([1, 20])} />);

    const first = container.querySelectorAll(".heatmap-day")[0];
    expect(Number(first.getAttribute("data-intensity"))).toBeGreaterThan(0);
  });

  it("gives the busiest day the top intensity", () => {
    const { container } = render(<StreakHeatmap history={history([1, 8])} />);

    expect(container.querySelectorAll(".heatmap-day")[1]).toHaveAttribute("data-intensity", "4");
  });

  it("describes each day for hover and screen readers", () => {
    const { container } = render(<StreakHeatmap history={history([2])} />);

    expect(container.querySelector(".heatmap-day").title).toMatch(/2 tasks completed/);
  });

  it("uses the singular for a single task", () => {
    const { container } = render(<StreakHeatmap history={history([1])} />);

    expect(container.querySelector(".heatmap-day").title).toMatch(/1 task completed/);
  });

  it("has an accessible name", () => {
    render(<StreakHeatmap history={history([1])} />);

    expect(screen.getByRole("img", { name: /daily task completion/i })).toBeInTheDocument();
  });
});
