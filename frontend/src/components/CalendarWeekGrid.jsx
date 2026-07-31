import { Fragment } from "react";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const firstHour = 0;
const lastHour = 23;

function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function buildDays(anchorDate) {
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

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export default function CalendarWeekGrid({ anchorDate }) {
  const days = buildDays(anchorDate);
  const now = new Date();
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (item, index) => firstHour + index
  );

  return (
    <div className="calendar-card">
      <div className="calendar-scroll">
        <div className="calendar-grid calendar-grid-week">
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
              <span
                className={
                  isSameDay(day, now)
                    ? "calendar-day-label calendar-day-label-today"
                    : "calendar-day-label"
                }
              >
                {dayNames[day.getDay()]} {day.getDate()}
              </span>
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
                >
                  {isSameDay(day, now) && hour === now.getHours() && (
                    <span
                      className="calendar-now-line"
                      style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                    ></span>
                  )}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
