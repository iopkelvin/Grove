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

export default function MiniCalendar() {
  const [monthDate, setMonthDate] = useState(new Date());
  const today = new Date();
  const cells = buildCells(monthDate);
  const showToday = isCurrentMonth(monthDate, today);

  function shiftMonth(direction) {
    const next = new Date(monthDate);
    next.setDate(1);
    next.setMonth(next.getMonth() + direction);
    setMonthDate(next);
  }

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
          {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
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
        {cells.map((dayNumber, index) => (
          <div
            key={index}
            className={
              showToday && dayNumber === today.getDate()
                ? "calendar-mini-day calendar-mini-day-today"
                : "calendar-mini-day"
            }
          >
            {dayNumber}
          </div>
        ))}
      </div>
    </div>
  );
}
