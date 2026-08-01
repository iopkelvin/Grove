// End-to-end-ish coverage of the Tasks page against a mocked API layer:
// enough to prove the page loads, creates, toggles, deletes and — the part
// that was missing entirely before — reports its failures.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { makeUserContext, renderWithProviders } from "../test/helpers";

const mockUser = vi.fn();
vi.mock("../context/UserContext", () => ({ useUser: () => mockUser() }));
vi.mock("../api/tasks", () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  clearCompletedTasks: vi.fn(),
}));

const tasksApi = await import("../api/tasks");
const { default: Tasks } = await import("./Tasks");

const aTask = (overrides = {}) => ({
  id: 1,
  title: "Read chapter three",
  done: false,
  tags: [],
  due_date: null,
  overdue: false,
  description: null,
  ...overrides,
});

function page(items = [], total = items.length) {
  return { items, total, limit: 100, offset: 0 };
}

describe("Tasks page", () => {
  beforeEach(() => {
    mockUser.mockReturnValue(makeUserContext());
    tasksApi.getTasks.mockResolvedValue(page([aTask()]));
  });

  it("lists the user's tasks", async () => {
    renderWithProviders(<Tasks />);

    expect(await screen.findByText("Read chapter three")).toBeInTheDocument();
  });

  it("shows a loading state first", () => {
    renderWithProviders(<Tasks />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("distinguishes an empty list from a failure", async () => {
    tasksApi.getTasks.mockResolvedValue(page([]));
    renderWithProviders(<Tasks />);

    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it("says so when loading fails, rather than showing the empty state", async () => {
    // The old code returned [] on any error, so a backend outage looked
    // exactly like having no tasks.
    tasksApi.getTasks.mockRejectedValue(new ApiError("Server exploded", { status: 500 }));
    renderWithProviders(<Tasks />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    expect(screen.queryByText(/nothing here yet/i)).not.toBeInTheDocument();
  });

  it("retries after a failure", async () => {
    tasksApi.getTasks.mockRejectedValueOnce(new ApiError("Boom", { status: 500 }));
    renderWithProviders(<Tasks />);

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Read chapter three")).toBeInTheDocument();
  });

  it("adds a task", async () => {
    tasksApi.createTask.mockResolvedValue(aTask({ id: 2, title: "Write the manual" }));
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.type(screen.getByLabelText(/new task title/i), "Write the manual");
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));

    expect(tasksApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Write the manual" })
    );
    expect(await screen.findByText("Write the manual")).toBeInTheDocument();
  });

  it("will not submit an empty title", async () => {
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    expect(screen.getByRole("button", { name: /add task/i })).toBeDisabled();
  });

  it("reports a rejected create instead of doing nothing", async () => {
    tasksApi.createTask.mockRejectedValue(
      new ApiError("Some fields are invalid.", {
        status: 400,
        fields: { title: "Must be at most 200 characters." },
      })
    );
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.type(screen.getByLabelText(/new task title/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));

    expect(await screen.findByText("Must be at most 200 characters.")).toBeInTheDocument();
  });

  it("ticks a task off", async () => {
    tasksApi.updateTask.mockResolvedValue(aTask({ done: true, streak_bumped: true }));
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.click(screen.getByRole("button", { name: /mark .* complete/i }));

    expect(tasksApi.updateTask).toHaveBeenCalledWith(1, { done: true });
  });

  it("only refreshes the profile when the streak actually moved", async () => {
    const context = makeUserContext();
    mockUser.mockReturnValue(context);
    tasksApi.updateTask.mockResolvedValue(aTask({ done: true, streak_bumped: false }));
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.click(screen.getByRole("button", { name: /mark .* complete/i }));

    await waitFor(() => expect(tasksApi.updateTask).toHaveBeenCalled());
    expect(context.refreshProfile).not.toHaveBeenCalled();
  });

  it("puts an optimistic toggle back when the request fails", async () => {
    tasksApi.updateTask.mockRejectedValue(new ApiError("Nope", { status: 500 }));
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.click(screen.getByRole("button", { name: /mark .* complete/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    // Back to unchecked: the label still offers to complete it.
    expect(
      await screen.findByRole("button", { name: /mark .* complete/i })
    ).toBeInTheDocument();
  });

  it("deletes a task once confirmed", async () => {
    tasksApi.deleteTask.mockResolvedValue(null);
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.click(screen.getByRole("button", { name: /delete "Read chapter three"/i }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(tasksApi.deleteTask).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(screen.queryByText("Read chapter three")).not.toBeInTheDocument()
    );
  });

  it("filters", async () => {
    renderWithProviders(<Tasks />);
    await screen.findByText("Read chapter three");

    await userEvent.click(screen.getByRole("tab", { name: "Done" }));

    await waitFor(() =>
      expect(tasksApi.getTasks).toHaveBeenLastCalledWith({ completed: true })
    );
  });
});
