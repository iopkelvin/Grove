// Presentational list of tasks. Holds no state of its own — the parent
// passes `tasks` plus the toggle/delete/edit-request handlers. The
// defaults (tasks = []) keep it safe to render with no props.

import { Square, CheckSquare, X, Pencil, Repeat } from "lucide-react";

function dueDateInfo(dueDate, dueTime, done) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateLabel = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timeLabel = dueTime
    ? new Date(`2000-01-01T${dueTime}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return {
    label: timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel,
    overdue: !done && due < today,
  };
}

function TaskItem({ task, onToggle, onDelete, onEditRequest }) {
  const due = dueDateInfo(task.due_date, task.due_time, task.done);

  return (
    <div className={`task-item ${task.done ? "task-item-done" : ""}`}>
      {/* API responses use "done" (not "completed"); see Task.to_dict() in api/models/task.py. */}
      <button
        className="task-checkbox"
        onClick={() => onToggle?.(task.id)}
        aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
      >
        {task.done ? <CheckSquare size={22} /> : <Square size={22} />}
      </button>

      <div className="task-body">
        <span className="task-title">{task.title}</span>

        {task.description && (
          <p className="task-description">{task.description}</p>
        )}

        {(task.recurring || due || task.tags?.length > 0) && (
          <div className="task-tags">
            {task.recurring && (
              <span className="task-tag task-tag-recurring">
                <Repeat size={11} /> Daily
              </span>
            )}
            {due && (
              <span className={`task-tag ${due.overdue ? "task-tag-overdue" : ""}`}>
                {due.label}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag} className="task-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Edit/delete: hidden until row hover (see tasks.css) */}
      {onEditRequest && (
        <button
          className="task-edit"
          onClick={() => onEditRequest(task)}
          aria-label="Edit task"
        >
          <Pencil size={16} />
        </button>
      )}
      <button
        className="task-delete"
        onClick={() => onDelete?.(task.id)}
        aria-label="Delete task"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default function TaskList({
  tasks = [],
  onToggle,
  onDelete,
  onEditRequest,
  emptyMessage = "Nothing here yet — add your first task above.",
  title,
}) {
  if (tasks.length === 0) {
    return (
      <div className="card task-list">
        {title && <p className="task-list-title">{title}</p>}
        <p className="task-empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="card task-list">
      {title && <p className="task-list-title">{title}</p>}
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onEditRequest={onEditRequest}
        />
      ))}
    </div>
  );
}
