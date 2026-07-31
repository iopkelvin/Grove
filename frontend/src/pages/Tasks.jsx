// Kyle
// pages/Tasks.jsx
//
// The Tasks page. Backed by the real /api/tasks endpoints now — identity
// comes from useUser().session.user, matching the plan already noted here
// before the backend existed.

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import MenuIcon from "../components/MenuIcon";
import TaskList from "../components/TaskList";

export default function Tasks() {
  const { session, loading, refreshProfile } = useUser();
  const supabaseId = session?.user?.id;

  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");

  const loadTasks = useCallback(async () => {
    if (!supabaseId) return;
    setTasks(await getTasks(supabaseId));
  }, [supabaseId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function addTask() {
    const title = newTitle.trim();
    if (!title || !supabaseId) return;

    const res = await createTask(supabaseId, { title, tags: [] });
    if (res.ok) {
      const task = await res.json();
      setTasks((prev) => [task, ...prev]);
      setNewTitle("");
    }
  }

  async function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !supabaseId) return;

    const nextDone = !task.done;
    const res = await updateTask(supabaseId, id, { done: nextDone });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)));
      // Completing a task can bump the streak — refresh so the tree/count
      // shown elsewhere (Home, Profile) reflects it without a reload.
      if (nextDone) {
        refreshProfile(supabaseId);
      }
    }
  }

  async function removeTask(id) {
    if (!supabaseId) return;
    const res = await deleteTask(supabaseId, id);
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

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

        <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} />
      </div>
    </div>
  );
}
