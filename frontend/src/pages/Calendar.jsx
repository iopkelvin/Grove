import { useState } from "react";
import MenuIcon from "../components/MenuIcon";
import CalendarViewToggle from "../components/CalendarViewToggle";
import CalendarNav from "../components/CalendarNav";
import CalendarWeekGrid from "../components/CalendarWeekGrid";
import CalendarMonthGrid from "../components/CalendarMonthGrid";

function Calendar() {
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(new Date());

  function shiftAnchor(direction) {
    const next = new Date(anchorDate);

    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    } else {
      next.setDate(next.getDate() + 7 * direction);
    }

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
            <CalendarNav
              onPrevious={() => shiftAnchor(-1)}
              onNext={() => shiftAnchor(1)}
            />
          </div>
          {view === "month" ? (
            <CalendarMonthGrid anchorDate={anchorDate} />
          ) : (
            <CalendarWeekGrid anchorDate={anchorDate} />
          )}
        </div>
        <div className="calendar-sidebar"></div>
      </div>
    </div>
  );
}

export default Calendar;
