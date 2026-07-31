const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cellCount = 42;

function buildCells(anchorDate) {
  const start = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1
  );
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: cellCount }, (item, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export default function CalendarMonthGrid({ anchorDate }) {
  const cells = buildCells(anchorDate);
  const today = new Date();

  return (
    <div className="calendar-card">
      <div className="calendar-month-header">
        {dayNames.map((name, index) => (
          <div
            key={name}
            className={
              index === 0 || index === 6
                ? "calendar-day-header calendar-day-header-weekend"
                : "calendar-day-header"
            }
          >
            {name}
          </div>
        ))}
      </div>
      <div className="calendar-month-grid">
        {cells.map((day, index) => {
          const outside = day.getMonth() !== anchorDate.getMonth();
          const cellClasses = ["calendar-month-cell"];

          if (index % 7 !== 0) {
            cellClasses.push("calendar-month-cell-divided");
          }

          if (outside) {
            cellClasses.push("calendar-month-cell-outside");
          }

          return (
            <div key={day.toDateString()} className={cellClasses.join(" ")}>
              <span
                className={
                  isSameDay(day, today)
                    ? "calendar-month-date calendar-month-date-today"
                    : "calendar-month-date"
                }
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
