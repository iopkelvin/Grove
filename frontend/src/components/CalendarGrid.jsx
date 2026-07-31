import { Fragment } from "react";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const firstHour = 0;
const lastHour = 23;

function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function buildDays(view, anchorDate) {
  if (view === "day") {
    return [new Date(anchorDate)];
  }

  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (item, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatHour(hour) {
  const period = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export default function CalendarGrid({ view, anchorDate }) {
  const days = buildDays(view, anchorDate);
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (item, index) => firstHour + index
  );

  return (
    <div className="calendar-card">
      <div className="calendar-scroll">
        <div
          className={
            view === "day"
              ? "calendar-grid calendar-grid-day"
              : "calendar-grid calendar-grid-week"
          }
        >
          <div className="calendar-grid-corner"></div>
          {days.map((day) => (
            <div
              key={day.toDateString()}
              className={
                isWeekend(day)
                  ? "calendar-day-header calendar-day-header-weekend"
                  : "calendar-day-header"
              }
            >
              {dayNames[day.getDay()]} {day.getDate()}
            </div>
          ))}
          {hours.map((hour) => (
            <Fragment key={hour}>
              <div className="calendar-hour-label">{formatHour(hour)}</div>
              {days.map((day, index) => (
                <div
                  key={day.toDateString()}
                  className={
                    index === 0
                      ? "calendar-hour-cell calendar-hour-cell-first"
                      : "calendar-hour-cell"
                  }
                ></div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
