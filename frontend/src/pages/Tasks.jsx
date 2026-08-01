// Tasks.
//
// What changed beyond the API rewrite:
//
//   * Failures are visible. Every handler used to be `if (res.ok) { ... }`
//     with no else, so a failed create simply did nothing and the user
//     retyped their task wondering what they had done wrong.
//   * Optimistic toggling, reverted if the request fails, so ticking a box
//     feels instant on a slow connection instead of lagging half a second.
//   * Filters, due dates and tags, which the model supported and the page
//     never exposed.
//   * The profile is only re-fetched when the streak actually moved.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { clearCompletedTasks, createTask, deleteTask, getTasks, updateTask } from "../api/tasks";
import PageLayout from "../components/PageLayout";
import TaskList from "../components/TaskList";
import { AsyncBoundary, EmptyState } from "../components/states";
import { useUser } from "../context/UserContext";
import { ApiError, messageFor } from "../lib/apiClient";

const FILTERS = [
  { key: "all", label: "All", params: {} },
  { key: "open", label: "Open", params: { completed: false } },
  { key: "done", label: "Done", params: { completed: true } },
];

export default function Tasks() {
  const { refreshProfile } = useUser();

  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [pendingIds, setPendingIds] = useState(new Set());

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const activeFilter = useMemo(
    () => FILTERS.find((option) => option.key === filter) ?? FILTERS[0],
    [filter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getTasks(activeFilter.params);
      setTasks(page.items);
      setTotal(page.total);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function markPending(id, pending) {
    setPendingIds((previous) => {
      const next = new Set(previous);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setCreating(true);
    setFormError("");
    setFieldErrors({});

    try {
      const created = await createTask({
        title: trimmed,
        due_date: dueDate || undefined,
        tags: tagInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      // Only prepend when the new task belongs in the current view;
      // otherwise the "Done" filter would show a task that is not done.
      if (filter !== "done") setTasks((previous) => [created, ...previous]);
      setTotal((previous) => previous + 1);
      setTitle("");
      setDueDate("");
      setTagInput("");
      setShowDetails(false);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setFormError(messageFor(err, "Could not add that task."));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(task) {
    const nextDone = !task.done;
    markPending(task.id, true);

    // Optimistic: flip it now, put it back if the server disagrees.
    setTasks((previous) =>
      previous.map((item) => (item.id === task.id ? { ...item, done: nextDone } : item))
    );

    try {
      const updated = await updateTask(task.id, { done: nextDone });
      setTasks((previous) =>
        previous.map((item) => (item.id === task.id ? { ...item, ...updated } : item))
      );
      if (updated.streak_bumped) refreshProfile();
      // Under a filter, the task may no longer belong in the list at all.
      if (filter !== "all") load();
    } catch (err) {
      setTasks((previous) =>
        previous.map((item) => (item.id === task.id ? { ...item, done: task.done } : item))
      );
      setFormError(messageFor(err, "Could not update that task."));
    } finally {
      markPending(task.id, false);
    }
  }

  async function handleDelete(task) {
    markPending(task.id, true);
    try {
      await deleteTask(task.id);
      setTasks((previous) => previous.filter((item) => item.id !== task.id));
      setTotal((previous) => Math.max(0, previous - 1));
    } catch (err) {
      setFormError(messageFor(err, "Could not delete that task."));
    } finally {
      markPending(task.id, false);
    }
  }

  async function handleClearCompleted() {
    try {
      await clearCompletedTasks();
      await load();
    } catch (err) {
      setFormError(messageFor(err, "Could not clear completed tasks."));
    }
  }

  const completedCount = tasks.filter((task) => task.done).length;

  return (
    <PageLayout
      title="Tasks"
      subtitle={total > 0 ? `${total} task${total === 1 ? "" : "s"}` : undefined}
    >
      <form className="task-add" onSubmit={handleCreate}>
        <div className="task-add-row">
          <input
            className="task-add-input"
            type="text"
            placeholder="Add a task…"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="New task title"
            aria-invalid={Boolean(fieldErrors.title)}
          />
          <button
            type="button"
            className="task-add-details"
            onClick={() => setShowDetails((value) => !value)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Less" : "More"}
          </button>
          <button
            className="task-add-button"
            type="submit"
            disabled={creating || !title.trim()}
            aria-label="Add task"
          >
            <Plus size={20} />
          </button>
        </div>

        {showDetails && (
          <div className="task-add-extra">
            <label>
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <label>
              Tags <span className="field-hint">comma separated</span>
              <input
                type="text"
                value={tagInput}
                placeholder="College, Today"
                onChange={(event) => setTagInput(event.target.value)}
              />
            </label>
          </div>
        )}

        {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}
        {formError && (
          <p className="auth-error" role="alert">
            {formError}
          </p>
        )}
      </form>

      <div className="task-filters" role="tablist" aria-label="Filter tasks">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={filter === option.key}
            className={filter === option.key ? "task-filter task-filter-active" : "task-filter"}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
        {completedCount > 0 && (
          <button type="button" className="task-clear" onClick={handleClearCompleted}>
            Clear completed
          </button>
        )}
      </div>

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={load}
        loadingLabel="Loading tasks"
        isEmpty={tasks.length === 0}
        empty={
          <EmptyState
            title={filter === "all" ? "Nothing here yet" : `No ${filter} tasks`}
            hint={
              filter === "all"
                ? "Add your first task above and your tree starts growing."
                : "Try a different filter."
            }
          />
        }
      >
        <TaskList
          tasks={tasks}
          onToggle={handleToggle}
          onDelete={handleDelete}
          pendingIds={pendingIds}
        />
      </AsyncBoundary>
    </PageLayout>
  );
}
