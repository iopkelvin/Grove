// Kyle
// components/TaskList.jsx
//
// Presentational list of tasks. Holds NO state of its own — the parent passes
// `tasks` plus the toggle/delete handlers. The defaults (tasks = []) keep it
// safe to render with no props, which is how Home.jsx currently uses it: there
// it simply shows the empty state until real data is wired in.

import { Square, CheckSquare, X } from "lucide-react";

export default function TaskList({ tasks = [], onToggle, onDelete }) {
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
        <div
          key={task.id}
          className={`task-item ${task.done ? "task-item-done" : ""}`}
        >
          {/* Checkbox: swaps between an empty and a checked square icon.
              Note: the API's Task.to_dict() deliberately serializes the
              `completed` column as "done" in the response — see the
              comment there. Requests still send { completed: ... }. */}
          <button
            className="task-checkbox"
            onClick={() => onToggle?.(task.id)}
            aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
          >
            {task.done ? <CheckSquare size={22} /> : <Square size={22} />}
          </button>

          <div className="task-body">
            <span className="task-title">{task.title}</span>

            {/* Tags are a many-to-many on the Task model; "Today" is just a tag */}
            {task.tags?.length > 0 && (
              <div className="task-tags">
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
      ))}
    </div>
  );
}
