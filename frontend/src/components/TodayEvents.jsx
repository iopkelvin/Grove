import { useUser } from "../context/UserContext";
import { useTasks } from "../hooks/useTasks";
import EventCard from "./EventCard";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayEvents() {
  const { session } = useUser();
  const { tasks, loading } = useTasks(session?.user?.id);
  const today = todayISO();

  const relevant = tasks.filter(
    (task) => !task.done && (task.recurring || task.due_date === today || (task.due_date && task.due_date < today))
  );

  return (
    <div className="today-events">
      <h2 className="today-events-title">Today's Events & Tasks</h2>
      <div className="today-events-list">
        {!loading && relevant.length === 0 && (
          <p className="today-events-empty">Nothing due today.</p>
        )}
        {relevant.map((task) => (
          <EventCard
            key={task.id}
            title={task.title}
            time={task.due_date && task.due_date < today ? "Overdue" : task.recurring ? "Daily habit" : "Due today"}
            type="task"
          />
        ))}
      </div>
    </div>
  );
}
