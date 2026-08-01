// Kyle
// pages/Tasks.jsx
//
// The Tasks page. Loads the signed-in user's tasks from /api/tasks on mount and
// keeps them in local state; add/toggle/delete call the backend, then update
// state from the server's response. Identity is the supabase_id from
// useUser().session.user.id — the same id the API resolves against. Task shape
// matches the API's Task.to_dict(): { id, title, completed, tags, ... }.

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import MenuIcon from "../components/MenuIcon";
import TaskList from "../components/TaskList";

export default function Tasks() {
  const { session, loading } = useUser();
  const supabaseId = session?.user?.id;

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

const loadTasks = useCallback(async () => {
  if (!supabaseId) {
    setTasks([]);
    setTasksLoading(false);
    return;
  }
  setTasksLoading(true);
  setTasks(await getTasks(supabaseId));
  setTasksLoading(false);
}, [supabaseId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function addTask() {
    const title = newTitle.trim();
    if (!title || !supabaseId) return;
    const res = await createTask(supabaseId, { title });
    if (res.ok) {
      const created = await res.json();
      setTasks((prev) => [...prev, created]);
      setNewTitle("");
    }
  }

  async function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const res = await updateTask(id, supabaseId, { completed: !task.completed });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  }

  // Named removeTask (not deleteTask) so it doesn't shadow the imported deleteTask.
  async function removeTask(id) {
    const res = await deleteTask(id, supabaseId);
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

  // Wait for auth to resolve before deciding what to show.
  if (loading) {
    return <div className="page">Loading...</div>;
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

        {tasksLoading ? (
          <div className="card task-list">
            <p className="task-empty">Loading tasks…</p>
          </div>
        ) : (
          <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} />
        )}
      </div>
    </div>
  );
}
