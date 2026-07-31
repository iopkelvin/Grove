export default function EventCard({ title, time, type }) {
  return (
    <div
      className={
        type === "task" ? "event-card event-card-task" : "event-card event-card-event"
      }
    >
      <span className="event-card-accent"></span>
      <div>
        <p className="event-card-title">{title}</p>
        <p className="event-card-time">{time}</p>
      </div>
    </div>
  );
}
