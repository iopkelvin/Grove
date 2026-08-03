import { Fragment } from "react";
import { startOfWeek, isSameDay } from "../utils/date";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// 5 AM - 10 PM — skips the overnight hours nobody schedules anything in.
const firstHour = 5;
const lastHour = 22;

// daysToShow === 1 gives a single-day column (Day view); anything else
// builds a full week starting from Sunday, same as before.
function buildDays(anchorDate, daysToShow) {
  if (daysToShow === 1) {
    return [new Date(anchorDate)];
  }
  const start = startOfWeek(anchorDate);
  return Array.from({ length: daysToShow }, (item, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatHour(hour) {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

export default function CalendarTimeGrid({ anchorDate, daysToShow = 7 }) {
  const days = buildDays(anchorDate, daysToShow);
  const now = new Date();
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (item, index) => firstHour + index
  );

  return (
    <div className="calendar-card">
      <div className="calendar-scroll">
        <div
          className="calendar-grid calendar-grid-week"
          style={{ "--calendar-days": days.length }}
        >
          <div className="calendar-grid-corner"></div>
          {days.map((day, index) => (
            <div
              key={day.toDateString()}
              className={[
                "calendar-day-header",
                index === days.length - 1 ? "calendar-day-header-last" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
              {days.map((day) => (
                <div
                  key={day.toDateString()}
                  className={
                    isSameDay(day, now)
                      ? "calendar-hour-cell calendar-hour-cell-today"
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
