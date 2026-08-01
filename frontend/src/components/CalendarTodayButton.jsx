export default function CalendarTodayButton({ onClick }) {
  return (
    <button type="button" className="calendar-today-button" onClick={onClick}>
      Jump to Today
    </button>
  );
}
