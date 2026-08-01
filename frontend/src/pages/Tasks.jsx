// Kyle
// pages/Tasks.jsx
//
// The Tasks page. Task fetch/mutate logic lives in useTasks so Home.jsx
// can share the exact same behavior instead of a second copy of it.
// Identity is the supabase_id from useUser().session.user.id — the same
// id the API resolves against.

import { useState } from "react";
import { Plus } from "lucide-react";
import { useUser } from "../context/UserContext";
import { useTasks } from "../hooks/useTasks";
import MenuIcon from "../components/MenuIcon";
import TaskList from "../components/TaskList";
import UndoToast from "../components/UndoToast";
import TaskFormModal from "../components/TaskFormModal";

export default function Tasks() {
  const { session, loading: authLoading } = useUser();
  const supabaseId = session?.user?.id;

  const {
    tasks, loading: tasksLoading, error, pendingDelete,
    addTask, toggleTask, editTask, removeTask, undoDelete,
  } = useTasks(supabaseId);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate(fields) {
    setCreating(true);
    await addTask(fields.title, {
      description: fields.description,
      tags: fields.tags,
      dueDate: fields.dueDate,
      recurring: fields.recurring,
    });
    setCreating(false);
    setShowModal(false);
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
        <button type="button" className="task-create-button" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Create task
        </button>

        {error && <p className="task-api-error">{error}</p>}
        <UndoToast task={pendingDelete} onUndo={undoDelete} />
        {tasksLoading ? (
          <div className="card task-list">
            <p className="task-empty">Loading tasks…</p>
          </div>
        ) : (
          <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} onEdit={editTask} />
        )}
      </div>

      {showModal && (
        <TaskFormModal
          supabaseId={supabaseId}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          creating={creating}
          error={error}
        />
      )}
    </div>
  );
}
