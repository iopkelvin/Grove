import { useState } from "react";
import MenuIcon from "../components/MenuIcon";
import CalendarViewToggle from "../components/CalendarViewToggle";
import CalendarNav from "../components/CalendarNav";
import CalendarTimeGrid from "../components/CalendarTimeGrid";
import MiniCalendar from "../components/MiniCalendar";
import TodayEvents from "../components/TodayEvents";
import CalendarTodayButton from "../components/CalendarTodayButton";
import { useUser } from "../context/UserContext";
import { useTasks } from "../hooks/useTasks";

function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isCurrentScope(view, anchorDate) {
  const today = new Date();
  if (view === "day") return isSameDay(anchorDate, today);
  if (view === "month") {
    return (
      anchorDate.getFullYear() === today.getFullYear() &&
      anchorDate.getMonth() === today.getMonth()
    );
  }
  return startOfWeek(anchorDate).toDateString() === startOfWeek(today).toDateString();
}

function Calendar() {
  const { session } = useUser();
  const { tasks } = useTasks(session?.user?.id);
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(new Date());

  function shiftAnchor(direction) {
    const next = new Date(anchorDate);
    next.setDate(next.getDate() + (view === "day" ? 1 : 7) * direction);
    setAnchorDate(next);
  }

  return (
    <div className="page calendar-page">
      <MenuIcon />
      <h1 className="page-title">Calendar</h1>
      <div className="calendar-layout">
        <div className="calendar-main">
          <div className="calendar-toolbar">
            <CalendarViewToggle view={view} onChange={setView} />
            <div className="calendar-toolbar-actions">
              {!isCurrentScope(view, anchorDate) && (
                <CalendarTodayButton onClick={() => setAnchorDate(new Date())} />
              )}
              {/* Month view uses MiniCalendar's own built-in prev/next month
                  nav — these arrows only make sense for the Week/Day grid. */}
              {view !== "month" && (
                <CalendarNav
                  onPrevious={() => shiftAnchor(-1)}
                  onNext={() => shiftAnchor(1)}
                />
              )}
            </div>
          </div>
          {view === "month" ? (
            <MiniCalendar tasks={tasks} monthDate={anchorDate} onMonthChange={setAnchorDate} />
          ) : (
            <CalendarTimeGrid anchorDate={anchorDate} daysToShow={view === "day" ? 1 : 7} />
          )}
        </div>
        <div className="calendar-sidebar">
          <TodayEvents />
        </div>
      </div>
    </div>
  );
}

export default Calendar;
