import { useState, useEffect, useCallback, useRef } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";

const UNDO_WINDOW_MS = 5000;

// Shared by Home.jsx and Tasks.jsx so both pages behave identically
// instead of maintaining two copies of the same fetch/mutate logic.
export function useTasks(supabaseId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteTimer = useRef(null);

  const load = useCallback(async () => {
    if (!supabaseId) return;
    setLoading(true);
    try {
      setTasks(await getTasks(supabaseId));
      setError("");
    } catch {
      setError("Tasks could not be loaded. Check that the Flask API is running.");
    } finally {
      setLoading(false);
    }
  }, [supabaseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Only one undo window open at a time — starting a new delete finalizes
  // whatever was already pending instead of stacking multiple toasts.
  function finalizePendingDelete() {
    if (!pendingDelete) return;
    clearTimeout(deleteTimer.current);
    deleteTask(supabaseId, pendingDelete.id).catch((err) => console.error("Failed to delete task:", err));
    setPendingDelete(null);
  }

  async function addTask(title, options) {
    const trimmed = title.trim();
    if (!trimmed || !supabaseId) return;
    try {
      const task = await createTask(supabaseId, trimmed, options);
      setTasks((current) => [task, ...current]);
      setError("");
    } catch {
      setError("The task could not be created.");
    }
  }

  async function toggleTask(id) {
    const currentTask = tasks.find((task) => task.id === id);
    if (!supabaseId || !currentTask) return;
    try {
      const updated = await updateTask(supabaseId, id, { completed: !currentTask.done });
      setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
      setError("");
    } catch {
      setError("The task could not be updated.");
    }
  }

  async function editTask(id, title) {
    const trimmed = title.trim();
    if (!trimmed || !supabaseId) return;
    try {
      const updated = await updateTask(supabaseId, id, { title: trimmed });
      setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
      setError("");
    } catch {
      setError("The task could not be updated.");
    }
  }

  function removeTask(id) {
    if (!supabaseId) return;
    finalizePendingDelete();

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    setTasks((current) => current.filter((t) => t.id !== id));
    setPendingDelete(task);
    deleteTimer.current = setTimeout(() => {
      deleteTask(supabaseId, id).catch((err) => console.error("Failed to delete task:", err));
      setPendingDelete(null);
    }, UNDO_WINDOW_MS);
  }

  function undoDelete() {
    if (!pendingDelete) return;
    clearTimeout(deleteTimer.current);
    setTasks((current) => [...current, pendingDelete].sort((a, b) => a.id - b.id));
    setPendingDelete(null);
  }

  return { tasks, loading, error, pendingDelete, addTask, toggleTask, editTask, removeTask, undoDelete };
}
