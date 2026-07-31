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
  const [newTitle, setNewTitle] = useState("");

  // added caching/sessions/errors
  const { session } = useUser();
  const [loading, setLoading] = useState(true);
  // DOCUMENTATION: https://react.dev/reference/react/useState
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  // ADDED CRUD AND API CALLS
  // check session and user ID
  // loads supabase data
  // https://react.dev/reference/react/useEffect
  useEffect(() => {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return;

    setLoading(true);
    getTasks(supabaseId)
      .then((data) => setTasks(data.map((task) => ({ ...task, done: task.completed }))))
      .catch(() => setError("Tasks could not be loaded. Check that the Flask API is running."))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);


// added CRUD AND API CALL, along with error check, everything else is the same.
// CRUD: CREATE TASK using session and caches, instead of set task
// added error check
// changed Date.now() to an async API call.
  async function addTask() {
    const title = newTitle.trim();

    // check session id, add if true
    const supabaseId = session?.user?.id;
    if (!title|| !supabaseId) return;


    try {
      const task = await createTask(supabaseId, title, ["Today"]);
      setTasks((current) => [{ ...task, done: task.completed }, ...current]);
      setNewTitle("");
      setError("");
    } catch {
      setError("The task could not be created.");
    }
    // setTasks((prev) => [
    //   ...prev,
    //   { id: Date.now(), title, done: false, tags: [] },
    // ]);
    // setNewTitle("");
  }

// changed toggle task to call api and update database.
  async function toggleTask(id) {
    // add task to current session
    const supabaseId = session?.user?.id;
    const currentTask = tasks.find((task) => task.id === id);
    if (!supabaseId || !currentTask) return;

    // CRUD - Update tasks, adding update functionality to the tasks
    // added catching and error debugging. 
    try {
      const updated = await updateTask(supabaseId, id, { completed: !currentTask.done });
      setTasks((current) =>
        current.map((t) => t.id === id ? { ...updated, done: updated.completed } : t)
      );
      setError("");
    } catch {
      setError("The task could not be updated.");
    }

    // commented out previous update functionality.
    // setTasks((prev) =>
    //   prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    // );
  }

  async function removeTask(id) {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return;
    try {
      await deleteTask(supabaseId, id);
      setTasks((current) => current.filter((task) => task.id !== id));
      setError("");
    } catch {
      setError("Task can't be updated.");
    }
  }
  // added CRUD and API functionality to the delte task function.
  // function deleteTask(id) {
  //   setTasks((prev) => prev.filter((t) => t.id !== id));
  // }

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

        {/* added error check for the api call.*/}
        {error && <p className="task-api-error">{error}</p>}
        {loading ? (
          <div className="card task-list"><p className="task-empty">Loading tasks…</p></div>
        ) : (
          // same as before
          <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} />
        )}
      </div>
    </div>
  );
}
