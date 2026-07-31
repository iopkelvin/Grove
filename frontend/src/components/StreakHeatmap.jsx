// Day-by-day activity grid.
//
// The backend returns a contiguous window with zero-count days filled in
// (see api/services/streak.py), so this component never has to reconstruct
// a calendar — it lays the days out in week columns and colours them.

const INTENSITY_STEPS = 4;

function intensityFor(count, busiest) {
  if (count <= 0) return 0;
  if (busiest <= 1) return INTENSITY_STEPS;
  // Ceil, so a day with any activity at all is always visibly non-empty
  // rather than rounding down into the "nothing happened" shade.
  return Math.max(1, Math.ceil((count / busiest) * INTENSITY_STEPS));
}

function describe(day, count) {
  const date = new Date(`${day}T00:00:00`);
  const label = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (count === 0) return `${label}: nothing completed`;
  return `${label}: ${count} task${count === 1 ? "" : "s"} completed`;
}

export default function StreakHeatmap({ history = [] }) {
  if (!history.length) return null;

  const busiest = Math.max(...history.map((entry) => entry.completed_count), 0);

  // Group into columns of seven so the grid reads as weeks. The window
  // starts on whatever weekday it starts on; a leading partial column would
  // need padding, and the extra precision is not worth the complexity here.
  const weeks = [];
  for (let index = 0; index < history.length; index += 7) {
    weeks.push(history.slice(index, index + 7));
  }

  return (
    <div className="heatmap" role="img" aria-label="Daily task completion for the last 13 weeks">
      {weeks.map((week, weekIndex) => (
        <div className="heatmap-week" key={week[0]?.day ?? weekIndex}>
          {week.map((entry) => (
            <div
              key={entry.day}
              className="heatmap-day"
              data-intensity={intensityFor(entry.completed_count, busiest)}
              // title carries the same text as the aria description so the
              // information is available on hover and to a screen reader.
              title={describe(entry.day, entry.completed_count)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
