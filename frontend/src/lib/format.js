// Small display helpers.

/** "kelvin" -> "Kelvin". Safe on null/undefined/"" — returns "". */
export function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

/**
 * A due date the way a person would say it.
 *
 * "Today" and "Tomorrow" carry far more urgency than "8/1/2026", and
 * "3 days overdue" is the thing the user needs to see at a glance.
 *
 * @param {string} isoDate YYYY-MM-DD
 */
export function formatDueDate(isoDate) {
  if (!isoDate) return "";

  // Parsed at local midnight, not UTC: `new Date("2026-08-01")` is UTC
  // midnight, which is the previous day for anyone west of Greenwich — so
  // a task due today would display as due yesterday in Berkeley.
  const due = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((due - today) / dayMs);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days < 7) return due.toLocaleDateString(undefined, { weekday: "long" });

  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "2026-07-31T12:00:00" -> "31 July 2026", or "" for anything unparseable. */
export function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
