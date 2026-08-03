import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarNav({ onPrevious, onNext }) {
  return (
    <div className="calendar-nav">
      <button
        type="button"
        className="calendar-nav-button"
        aria-label="Previous"
        onClick={onPrevious}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className="calendar-nav-button"
        aria-label="Next"
        onClick={onNext}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
