// Kyle
// pages/Tasks.jsx
//
// The Tasks page. For now it owns its task list in local state seeded with mock
// data, because the Flask /api/tasks endpoints are still stubs (they `pass`).
// When they're implemented, swap INITIAL_TASKS + the three handlers for fetch
// calls — the rest of the UI won't change. If/when a task needs to be tied to
// the signed-in user, identity comes from useUser().session.user.

import { useState } from "react";
import { Plus } from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import TaskList from "../components/TaskList";

// Stand-in for the backend. Shape mirrors the Task model: id, title, done, tags.
const INITIAL_TASKS = [
  { id: 1, title: "Finish CS 160 hi-fi prototype", done: false, tags: ["Today", "School"] },
  { id: 2, title: "Model Janss House roof in Rhino", done: false, tags: ["School"] },
  { id: 3, title: "Reply to Kelvin about app.py", done: true, tags: ["Today"] },
];

export default function Tasks() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [newTitle, setNewTitle] = useState("");

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setTasks((prev) => [
      ...prev,
      { id: Date.now(), title, done: false, tags: [] },
    ]);
    setNewTitle("");
  }

  function toggleTask(id) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">Tasks</h1>

      <div className="page-content task-page-content">
        {/* Add-task row. Input styling mirrors the auth form for consistency. */}
        <div className="task-add">
          <input
            className="task-add-input"
            type="text"
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
          />
          <button className="task-add-button" onClick={addTask} aria-label="Add task">
            <Plus size={20} />
          </button>
        </div>

        <TaskList tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} />
      </div>
    </div>
  );
}
