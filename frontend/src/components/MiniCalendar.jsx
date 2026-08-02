import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function buildCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((leading + dayCount) / 7) * 7;

  return Array.from({ length: total }, (item, index) => {
    const dayNumber = index - leading + 1;
    return dayNumber > 0 && dayNumber <= dayCount ? dayNumber : null;
  });
}

function isCurrentMonth(monthDate, today) {
  return (
    monthDate.getFullYear() === today.getFullYear() &&
    monthDate.getMonth() === today.getMonth()
  );
}

// YYYY-MM-DD, matching the format tasks' due_date already comes in — no
// timezone conversion needed since both sides stay in local calendar terms.
function toISODate(year, month, dayNumber) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
}

export default function MiniCalendar({ tasks = [], season = "none" }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const today = new Date();
  const cells = buildCells(monthDate);
  const showToday = isCurrentMonth(monthDate, today);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  function shiftMonth(direction) {
    const next = new Date(monthDate);
    next.setDate(1);
    next.setMonth(next.getMonth() + direction);
    setMonthDate(next);
    setSelectedDay(null);
  }

  const selectedISO = selectedDay ? toISODate(year, month, selectedDay) : null;
  const tasksForSelectedDay = selectedISO
    ? tasks.filter((task) => task.due_date === selectedISO && !task.done)
    : [];

  return (
    <div className="calendar-mini">
      <div className="calendar-mini-header">
        <button
          type="button"
          className="calendar-mini-button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="calendar-mini-title">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          className="calendar-mini-button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-mini-grid">
        {weekdayNames.map((name) => (
          <div key={name} className="calendar-mini-weekday">
            {name}
          </div>
        ))}
        {cells.map((dayNumber, index) => {
          if (!dayNumber) {
            return <div key={index} className="calendar-mini-day calendar-mini-day-empty" />;
          }
          const isToday = showToday && dayNumber === today.getDate();
          const isSelected = dayNumber === selectedDay;
          return (
            <button
              key={index}
              type="button"
              className={[
                "calendar-mini-day",
                isToday ? "calendar-mini-day-today" : "",
                isSelected ? `calendar-mini-day-selected calendar-mini-day-selected--${season}` : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedDay(isSelected ? null : dayNumber)}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div className="calendar-mini-day-tasks">
          {tasksForSelectedDay.length === 0 ? (
            <p>No tasks due</p>
          ) : (
            <ul>
              {tasksForSelectedDay.slice(0, 3).map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
              {tasksForSelectedDay.length > 3 && <li>+{tasksForSelectedDay.length - 3} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
