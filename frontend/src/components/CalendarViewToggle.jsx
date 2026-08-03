const views = [
  { id: "month", label: "Month View" },
  { id: "week", label: "Week View" },
  { id: "day", label: "Day View" },
];

export default function CalendarViewToggle({ view, onChange }) {
  return (
    <div className="calendar-view-toggle">
      {views.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            view === item.id
              ? "calendar-view-option calendar-view-option-active"
              : "calendar-view-option"
          }
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
