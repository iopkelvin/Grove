// The Tasks page. Fetch/mutate logic lives in useTasks so Home.jsx shares
// the exact same behavior instead of duplicating it. Identity is the
// supabase_id from useUser().session.user.id — the same id the API
// resolves against.

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useUser } from "../context/UserContext";
import { useTasks } from "../hooks/useTasks";
import MenuIcon from "../components/MenuIcon";
import TaskList from "../components/TaskList";
import UndoToast from "../components/UndoToast";
import TaskFormModal from "../components/TaskFormModal";

const STATUS_FILTERS = [
  { key: "active", label: "Active" },
  { key: "complete", label: "Complete" },
  { key: "recurring", label: "Recurring" },
  { key: "all", label: "All" },
];

export default function Tasks() {
  const { session, loading: authLoading } = useUser();
  const supabaseId = session?.user?.id;

  const {
    tasks, loading: tasksLoading, error, pendingDelete,
    addTask, toggleTask, editTask, removeTask, undoDelete,
  } = useTasks(supabaseId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [activeTag, setActiveTag] = useState(null);

  const tags = useMemo(() => {
    const names = new Set();
    tasks.forEach((task) => task.tags?.forEach((name) => names.add(name)));
    return [...names].sort();
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (activeTag && !task.tags?.includes(activeTag)) return false;
      if (statusFilter === "active") return !task.done;
      if (statusFilter === "complete") return task.done;
      if (statusFilter === "recurring") return task.recurring;
      return true;
    });
  }, [tasks, statusFilter, activeTag]);

  async function handleSubmit(fields) {
    setSubmitting(true);
    const ok = editingTask
      ? await editTask(editingTask.id, fields)
      : await addTask(fields.title, {
          description: fields.description,
          tags: fields.tags,
          dueDate: fields.dueDate,
          dueTime: fields.dueTime,
          recurring: fields.recurring,
        });
    setSubmitting(false);
    if (ok) {
      setShowCreateModal(false);
      setEditingTask(null);
    }
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingTask(null);
  }

  // Wait for auth to resolve before deciding what to show.
  if (authLoading) {
    return <div className="page">Loading...</div>;
  }

  const showModal = showCreateModal || Boolean(editingTask);

  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">Tasks</h1>

      <div className="page-content task-page-content">
        <button type="button" className="task-create-button" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> Create task
        </button>

        <div className="task-status-tabs">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`task-status-tab${statusFilter === key ? " task-status-tab-active" : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="task-filter-scroll">
            <button
              type="button"
              className={`task-tag-option${activeTag === null ? " task-tag-option-selected" : ""}`}
              onClick={() => setActiveTag(null)}
            >
              All tags
            </button>
            {tags.map((name) => (
              <button
                key={name}
                type="button"
                className={`task-tag-option${activeTag === name ? " task-tag-option-selected" : ""}`}
                onClick={() => setActiveTag((current) => (current === name ? null : name))}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {error && <p className="task-api-error">{error}</p>}
        <UndoToast task={pendingDelete} onUndo={undoDelete} />
        {tasksLoading ? (
          <div className="card task-list">
            <p className="task-empty">Loading tasks…</p>
          </div>
        ) : (
          <TaskList
            tasks={visibleTasks}
            onToggle={toggleTask}
            onDelete={removeTask}
            onEditRequest={setEditingTask}
          />
        )}
      </div>

      {showModal && (
        <TaskFormModal
          supabaseId={supabaseId}
          task={editingTask}
          onClose={closeModal}
          onSubmit={handleSubmit}
          creating={submitting}
          error={error}
        />
      )}
    </div>
  );
}
