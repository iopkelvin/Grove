// Kyle
// pages/Tasks.jsx
//
// The Tasks page. Loads the signed-in user's tasks from /api/tasks on mount
// and keeps them in local state; add/toggle/delete call the backend, then
// update state from the server's response. Identity is the supabase_id from
// useUser().session.user.id — the same id the API resolves against. Task
// shape matches the API's Task.to_dict(): { id, title, completed, tags, ... }.

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import MenuIcon from "../components/MenuIcon";
import TaskList from "../components/TaskList";

export default function Tasks() {
  const { session, loading: authLoading } = useUser();
  const supabaseId = session?.user?.id;

  const [newTitle, setNewTitle] = useState("");
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseId) return;

    setTasksLoading(true);
    getTasks(supabaseId)
      .then(setTasks)
      .catch(() => setError("Tasks could not be loaded. Check that the Flask API is running."))
      .finally(() => setTasksLoading(false));
  }, [supabaseId]);

  async function addTask() {
    const title = newTitle.trim();
    if (!title || !supabaseId) return;

    try {
      const task = await createTask(supabaseId, title, ["Today"]);
      setTasks((current) => [task, ...current]);
      setNewTitle("");
      setError("");
    } catch {
      setError("The task could not be created.");
    }
  }

  async function toggleTask(id) {
    const currentTask = tasks.find((task) => task.id === id);
    if (!supabaseId || !currentTask) return;

    try {
      const updated = await updateTask(supabaseId, id, { completed: !currentTask.completed });
      setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
      setError("");
    } catch {
      setError("The task could not be updated.");
    }
  }

  // Named removeTask (not deleteTask) so it doesn't shadow the imported deleteTask.
  async function removeTask(id) {
    if (!supabaseId) return;
    try {
      await deleteTask(supabaseId, id);
      setTasks((current) => current.filter((task) => task.id !== id));
      setError("");
    } catch {
      setError("Task can't be deleted.");
    }
  }

  // Wait for auth to resolve before deciding what to show.
  if (authLoading) {
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

        {error && <p className="task-api-error">{error}</p>}
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
