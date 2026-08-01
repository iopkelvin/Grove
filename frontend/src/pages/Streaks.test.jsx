import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { makeUserContext, renderWithProviders } from "../test/helpers";

const mockUser = vi.fn();
vi.mock("../context/UserContext", () => ({ useUser: () => mockUser() }));
vi.mock("../api/streaks", () => ({ getMyStreak: vi.fn() }));

const streaksApi = await import("../api/streaks");
const { default: Streaks } = await import("./Streaks");

const summary = (overrides = {}) => ({
  current_count: 4,
  longest_count: 12,
  total_days: 30,
  tasks_completed: 57,
  last_activity_date: "2026-07-31",
  active_today: true,
  at_risk: false,
  history: Array.from({ length: 91 }, (_, index) => ({
    day: `2026-05-${String((index % 28) + 1).padStart(2, "0")}`,
    completed_count: index % 5,
  })),
  tasks: { total: 60, completed: 57, open: 3, overdue: 0, due_today: 1, completed_this_week: 4 },
  ...overrides,
});

describe("Streaks page", () => {
  beforeEach(() => {
    mockUser.mockReturnValue(makeUserContext());
    streaksApi.getMyStreak.mockResolvedValue(summary());
  });

  it("shows the headline numbers", async () => {
    renderWithProviders(<Streaks />);

    expect(await screen.findByText("Current streak")).toBeInTheDocument();
    expect(screen.getByText("Longest streak")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("57")).toBeInTheDocument();
  });

  it("draws the heatmap", async () => {
    const { container } = renderWithProviders(<Streaks />);
    await screen.findByText("Current streak");

    expect(container.querySelectorAll(".heatmap-day")).toHaveLength(91);
  });

  it("nudges when the streak is alive but today is unlogged", async () => {
    streaksApi.getMyStreak.mockResolvedValue(summary({ at_risk: true, active_today: false }));
    renderWithProviders(<Streaks />);

    expect(await screen.findByText(/today is not logged yet/i)).toBeInTheDocument();
  });

  it("stays quiet when today is already logged", async () => {
    renderWithProviders(<Streaks />);
    await screen.findByText("Current streak");

    expect(screen.queryByText(/not logged yet/i)).not.toBeInTheDocument();
  });

  it("explains what to do when there is no history at all", async () => {
    streaksApi.getMyStreak.mockResolvedValue(
      summary({ total_days: 0, current_count: 0, longest_count: 0, tasks_completed: 0 })
    );
    renderWithProviders(<Streaks />);

    expect(await screen.findByText(/no activity recorded yet/i)).toBeInTheDocument();
  });

  it("reports a failure and offers a retry", async () => {
    streaksApi.getMyStreak.mockRejectedValueOnce(new ApiError("Down", { status: 503 }));
    renderWithProviders(<Streaks />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Down");

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Current streak")).toBeInTheDocument();
  });
});
