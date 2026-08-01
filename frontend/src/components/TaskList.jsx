// Kyle
// components/TaskList.jsx
//
// Presentational list of tasks. Holds NO state of its own except the
// per-row edit-in-progress text — the parent passes `tasks` plus the
// toggle/delete/edit handlers. The defaults (tasks = []) keep it safe to
// render with no props.

import { useState } from "react";
import { Square, CheckSquare, X, Repeat } from "lucide-react";

function dueDateInfo(dueDate, done) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    label: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    overdue: !done && due < today,
  };
}

function TaskItem({ task, onToggle, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const due = dueDateInfo(task.due_date, task.done);

  function startEditing() {
    setDraft(task.title);
    setIsEditing(true);
  }

  function saveEdit() {
    setIsEditing(false);
    if (draft.trim() && draft.trim() !== task.title) {
      onEdit?.(task.id, draft);
    }
  }

  return (
    <div className={`task-item ${task.done ? "task-item-done" : ""}`}>
      {/* Note: the API's Task.to_dict() serializes completion as "done"
          in the response (see the comment there); requests still send
          { completed: ... }. */}
      <button
        className="task-checkbox"
        onClick={() => onToggle?.(task.id)}
        aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
      >
        {task.done ? <CheckSquare size={22} /> : <Square size={22} />}
      </button>

      <div className="task-body">
        {isEditing ? (
          <input
            className="task-edit-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
        ) : (
          <span className="task-title" onClick={startEditing}>
            {task.title}
          </span>
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

      {/* Delete: hidden until row hover (see tasks.css) */}
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

export default function TaskList({ tasks = [], onToggle, onDelete, onEdit }) {
  if (tasks.length === 0) {
    return (
      <div className="card task-list">
        <p className="task-empty">Nothing here yet — add your first task above.</p>
      </div>
    );
  }

  return (
    <div className="card task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
      ))}
    </div>
  );
}
