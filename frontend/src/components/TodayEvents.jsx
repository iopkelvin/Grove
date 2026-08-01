import EventCard from "./EventCard";

// [pending]: Placeholders
const entries = [
  { id: 1, title: "CS161 Project Meet", time: "9:00am - 10:00am", type: "event" },
  { id: 2, title: "Study for Finals", time: "10:30am - 3:00pm", type: "task" },
  { id: 3, title: "CS161 P2 Design Doc", time: "4:00pm - 5:00pm", type: "task" },
  { id: 4, title: "CS160 Project Meet", time: "5:00pm - 7:00pm", type: "event" },
];

export default function TodayEvents() {
  return (
    <div className="today-events">
      <h2 className="today-events-title">Todays Events & Tasks</h2>
      <div className="today-events-list">
        {entries.map((entry) => (
          <EventCard
            key={entry.id}
            title={entry.title}
            time={entry.time}
            type={entry.type}
          />
        ))}
      </div>
    </div>
  );
}
