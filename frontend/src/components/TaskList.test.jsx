import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TaskList from "./TaskList";

const task = (overrides = {}) => ({
  id: 1,
  title: "Read chapter three",
  done: false,
  tags: [],
  due_date: null,
  overdue: false,
  ...overrides,
});

describe("TaskList", () => {
  it("renders nothing when there are no tasks", () => {
    const { container } = render(<TaskList tasks={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows each task's title", () => {
    render(<TaskList tasks={[task(), task({ id: 2, title: "Write the manual" })]} />);

    expect(screen.getByText("Read chapter three")).toBeInTheDocument();
    expect(screen.getByText("Write the manual")).toBeInTheDocument();
  });

  it("labels the checkbox with what it will do", () => {
    render(<TaskList tasks={[task()]} />);

    expect(
      screen.getByRole("button", { name: 'Mark "Read chapter three" complete' })
    ).toBeInTheDocument();
  });

  it("labels a completed task's checkbox the other way round", () => {
    render(<TaskList tasks={[task({ done: true })]} />);

    expect(
      screen.getByRole("button", { name: 'Mark "Read chapter three" incomplete' })
    ).toBeInTheDocument();
  });

  it("passes the whole task to onToggle", async () => {
    const onToggle = vi.fn();
    render(<TaskList tasks={[task()]} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: /mark .* complete/i }));

    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("asks before deleting", async () => {
    const onDelete = vi.fn();
    render(<TaskList tasks={[task()]} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: /delete "Read chapter three"/i }));

    // One click arms the confirmation; it must not have deleted anything.
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("deletes once confirmed", async () => {
    const onDelete = vi.fn();
    render(<TaskList tasks={[task()]} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: /delete "Read chapter three"/i }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("can be backed out of", async () => {
    const onDelete = vi.fn();
    render(<TaskList tasks={[task()]} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: /delete "Read chapter three"/i }));
    await userEvent.click(screen.getByRole("button", { name: /keep task/i }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows tags", () => {
    render(<TaskList tasks={[task({ tags: ["College", "Today"] })]} />);

    expect(screen.getByText("College")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows a due date in words", () => {
    // Built from the local date, not toISOString(): the latter is UTC, so
    // an evening test run in Berkeley would produce tomorrow's date and
    // this would assert on "Tomorrow" without anyone noticing.
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    render(<TaskList tasks={[task({ due_date: today })]} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("disables the row while a request is in flight", () => {
    render(<TaskList tasks={[task()]} pendingIds={new Set([1])} />);

    expect(screen.getByRole("button", { name: /mark .* complete/i })).toBeDisabled();
  });
});
