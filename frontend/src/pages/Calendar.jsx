import { useState } from "react";
import MenuIcon from "../components/MenuIcon";
import CalendarViewToggle from "../components/CalendarViewToggle";
import CalendarNav from "../components/CalendarNav";
import CalendarGrid from "../components/CalendarGrid";

function Calendar() {
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(new Date());

  function shiftAnchor(direction) {
    const step = view === "week" ? 7 : 1;
    const next = new Date(anchorDate);
    next.setDate(next.getDate() + step * direction);
    setAnchorDate(next);
  }

  return (
    <div className="page">
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
          <CalendarGrid view={view} anchorDate={anchorDate} />
        </div>
        <div className="calendar-sidebar"></div>
      </div>
    </div>
  );
}

export default Calendar;
