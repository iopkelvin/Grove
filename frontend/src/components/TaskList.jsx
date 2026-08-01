// Presentational list of tasks.
//
// Holds no state of its own — the parent passes the tasks and the handlers.
// Additions over the previous version: due dates and an overdue treatment,
// a confirmation step before deleting (a single misplaced click used to
// destroy a task with no undo), and a disabled state while a row is in
// flight so double-clicking cannot fire two requests.

import { useState } from "react";
import { CheckSquare, Square, Trash2, X } from "lucide-react";

import { formatDueDate } from "../lib/format";

export default function TaskList({ tasks = [], onToggle, onDelete, pendingIds = new Set() }) {
  const [confirmingId, setConfirmingId] = useState(null);

  if (tasks.length === 0) return null;

  return (
    <ul className="card task-list">
      {tasks.map((task) => {
        const pending = pendingIds.has(task.id);
        const confirming = confirmingId === task.id;

        return (
          <li
            key={task.id}
            className={[
              "task-item",
              task.done ? "task-item-done" : "",
              task.overdue ? "task-item-overdue" : "",
              pending ? "task-item-pending" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              className="task-checkbox"
              onClick={() => onToggle?.(task)}
              disabled={pending}
              aria-label={
                task.done ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`
              }
            >
              {task.done ? <CheckSquare size={22} /> : <Square size={22} />}
            </button>

            <div className="task-body">
              <span className="task-title">{task.title}</span>
              {task.description && <span className="task-description">{task.description}</span>}

              <div className="task-meta">
                {task.due_date && (
                  <span className={task.overdue ? "task-due task-due-late" : "task-due"}>
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                {/* Tags are a many-to-many on the Task model; "Today" is
                    just a tag. */}
                {task.tags?.map((tag) => (
                  <span key={tag} className="task-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {confirming ? (
              <div className="task-confirm">
                <button
                  type="button"
                  className="task-confirm-yes"
                  onClick={() => {
                    setConfirmingId(null);
                    onDelete?.(task);
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  aria-label="Keep task"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                className="task-delete"
                onClick={() => setConfirmingId(task.id)}
                disabled={pending}
                aria-label={`Delete "${task.title}"`}
              >
                <Trash2 size={18} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
