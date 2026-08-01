// "Up Next" on the home page.
//
// The entire previous implementation was:
//
//     export default function UpNextCard() {
//       return <div className="card">Up Next Card</div>;
//     }
//
// It now shows what the backend considers most urgent — overdue and
// due-soon first, then the oldest undated task — and lets you tick things
// off without leaving the page.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckSquare, Square } from "lucide-react";

import { getUpNext, updateTask } from "../api/tasks";
import { useUser } from "../context/UserContext";
import { formatDueDate } from "../lib/format";
import { EmptyState, ErrorState, LoadingState } from "./states";

export default function UpNextCard({ onChanged }) {
  const { refreshProfile } = useUser();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await getUpNext());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(task) {
    setPendingId(task.id);
    try {
      const updated = await updateTask(task.id, { done: true });
      setTasks((previous) => previous.filter((item) => item.id !== task.id));
      onChanged?.();
      // Only re-fetch the profile when the streak actually moved. The old
      // Tasks page refreshed it on every completion, which meant a request
      // per click to learn that nothing had changed.
      if (updated.streak_bumped) refreshProfile();
    } catch (err) {
      setError(err);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="card upnext-card">
      <h2 className="card-title">
        <CalendarClock size={18} aria-hidden="true" /> Up Next
      </h2>

      {error ? (
        <ErrorState error={error} onRetry={load} title="Could not load your tasks" />
      ) : loading ? (
        <LoadingState label="Loading tasks" inline />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Nothing on deck"
          hint="Add a task and the most urgent one shows up here."
          action={
            <Link className="state-retry" to="/tasks">
              Go to Tasks
            </Link>
          }
        />
      ) : (
        <ul className="upnext-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.overdue ? "upnext-item upnext-overdue" : "upnext-item"}>
              <button
                type="button"
                className="task-checkbox"
                onClick={() => complete(task)}
                disabled={pendingId === task.id}
                aria-label={`Mark "${task.title}" complete`}
              >
                {pendingId === task.id ? <CheckSquare size={20} /> : <Square size={20} />}
              </button>
              <span className="upnext-title">{task.title}</span>
              {task.due_date && (
                <span className="upnext-due">{formatDueDate(task.due_date)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
