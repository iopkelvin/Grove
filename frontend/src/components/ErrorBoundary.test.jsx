import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "./ErrorBoundary";

function Explode() {
  throw new Error("component blew up");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the caught error itself; silencing it keeps the test
    // output readable without hiding a real regression.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders its children when nothing is wrong", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a message instead of a blank page when a child throws", () => {
    render(
      <ErrorBoundary>
        <Explode />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/unexpected problem/i);
  });

  it("offers a way back", () => {
    render(
      <ErrorBoundary>
        <Explode />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
  });

  it("reassures the user that nothing was lost", () => {
    render(
      <ErrorBoundary>
        <Explode />
      </ErrorBoundary>
    );

    expect(screen.getByText(/your data is safe/i)).toBeInTheDocument();
  });
});
