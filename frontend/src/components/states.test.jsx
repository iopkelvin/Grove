// The point of these components is that loading, empty and error are
// visibly different from one another. That is what these tests assert.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { AsyncBoundary, EmptyState, ErrorState, LoadingState } from "./states";

describe("LoadingState", () => {
  it("announces itself to assistive technology", () => {
    render(<LoadingState label="Loading tasks" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading tasks");
  });
});

describe("EmptyState", () => {
  it("shows the title and hint", () => {
    render(<EmptyState title="Nothing here yet" hint="Add your first task." />);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first task.")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("is an alert, not a quiet paragraph", () => {
    render(<ErrorState error={new ApiError("Task not found.", { status: 404 })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Task not found.");
  });

  it("words a connection failure differently from a server error", () => {
    render(<ErrorState error={new ApiError("Could not reach the server.", { status: 0 })} />);

    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it("shows the request id so it can be quoted in a report", () => {
    render(
      <ErrorState error={new ApiError("Boom", { status: 500, requestId: "abc123" })} />
    );

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("retries when asked", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError("Boom")} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("says something sensible for a non-ApiError", () => {
    render(<ErrorState error={new TypeError("x is undefined")} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});

describe("AsyncBoundary", () => {
  it("prefers the error over the loading state", () => {
    render(
      <AsyncBoundary loading error={new ApiError("Boom")}>
        <p>content</p>
      </AsyncBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows loading before empty", () => {
    render(
      <AsyncBoundary loading isEmpty empty={<p>nothing</p>}>
        <p>content</p>
      </AsyncBoundary>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("nothing")).not.toBeInTheDocument();
  });

  it("shows the empty state once loading is done and there is nothing", () => {
    render(
      <AsyncBoundary loading={false} isEmpty empty={<p>nothing</p>}>
        <p>content</p>
      </AsyncBoundary>
    );

    expect(screen.getByText("nothing")).toBeInTheDocument();
  });

  it("renders the children when all is well", () => {
    render(
      <AsyncBoundary loading={false} error={null}>
        <p>content</p>
      </AsyncBoundary>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
