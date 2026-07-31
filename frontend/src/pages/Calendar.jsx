import MenuIcon from "../components/MenuIcon";

function Calendar() {
  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">Calendar</h1>
      <div className="calendar-layout">
        <div className="calendar-main"></div>
        <div className="calendar-sidebar"></div>
      </div>
    </div>
  );
}

export default Calendar;
