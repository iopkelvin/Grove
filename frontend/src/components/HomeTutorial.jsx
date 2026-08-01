import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Menu,
  Sprout,
  Users,
  X,
} from "lucide-react";

const STEPS = [
  {
    selector: ".menu-icon",
    icon: Menu,
    title: "Navigation menu",
    description:
      "Open the menu to visit your profile, friends, tasks, study rooms, streaks, and settings.",
  },
  {
    selector: '[data-home-tour="streak"]',
    icon: Sprout,
    title: "Your streak",
    description:
      "Finish tasks consistently to build your streak and grow your Grove tree.",
  },
  {
    selector: '[data-home-tour="friends"]',
    icon: Users,
    title: "Friends",
    description:
      "See who is online and connect with classmates for shared study sessions.",
  },
  {
    selector: '[data-home-tour="calendar"]',
    icon: CalendarDays,
    title: "Calendar",
    description:
      "Use the calendar to keep track of assignments, study sessions, and important dates.",
  },
  {
    selector: '[data-home-tour="up-next"]',
    icon: Clock3,
    title: "Up next",
    description:
      "Check the next activity or event that needs your attention.",
  },
  {
    selector: '[data-home-tour="tasks"]',
    icon: CheckSquare,
    title: "Tasks",
    description:
      "Review your current tasks and mark them complete as you finish your work.",
  },
];

const SCREEN_PADDING = 16;
const POPOVER_GAP = 16;
const ESTIMATED_POPOVER_HEIGHT = 285;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export default function HomeTutorial({ onComplete, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = STEPS[stepIndex];
  const StepIcon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    const target = document.querySelector(step.selector);

    if (!target) {
      console.warn(`Home tutorial target not found: ${step.selector}`);

      if (isLast) onComplete();
      else setStepIndex((current) => current + 1);

      return undefined;
    }

    function updateTargetRect() {
      const rect = target.getBoundingClientRect();

      setTargetRect({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    updateTargetRect();
    const timer = window.setTimeout(updateTargetRect, 350);

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [isLast, onComplete, step.selector]);

  const position = useMemo(() => {
    if (!targetRect) return null;

    const popoverWidth = Math.min(
      360,
      window.innerWidth - SCREEN_PADDING * 2
    );

    const left = clamp(
      targetRect.left,
      SCREEN_PADDING,
      window.innerWidth - popoverWidth - SCREEN_PADDING
    );

    let top = targetRect.bottom + POPOVER_GAP;

    if (
      top + ESTIMATED_POPOVER_HEIGHT >
      window.innerHeight - SCREEN_PADDING
    ) {
      top = Math.max(
        SCREEN_PADDING,
        targetRect.top - ESTIMATED_POPOVER_HEIGHT - POPOVER_GAP
      );
    }

    return { top, left, width: popoverWidth };
  }, [targetRect]);

  if (!targetRect || !position) return null;

  function goNext() {
    if (isLast) {
      onComplete();
      return;
    }

    setTargetRect(null);
    setStepIndex((current) => current + 1);
  }

  function goBack() {
    if (isFirst) return;

    setTargetRect(null);
    setStepIndex((current) => current - 1);
  }

  return createPortal(
    <>
      <div className="home-tour-blocker" aria-hidden="true" />

      <div
        className="home-tour-highlight"
        style={{
          top: targetRect.top - 7,
          left: targetRect.left - 7,
          width: targetRect.width + 14,
          height: targetRect.height + 14,
        }}
        aria-hidden="true"
      />

      <section
        className="home-tour-popover"
        style={position}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-tour-title"
      >
        <button
          className="home-tour-close"
          type="button"
          onClick={onClose}
          aria-label="Close tutorial"
        >
          <X size={20} />
        </button>

        <div className="home-tour-icon" aria-hidden="true">
          <StepIcon size={28} />
        </div>

        <p className="home-tour-step">
          Step {stepIndex + 1} of {STEPS.length}
        </p>

        <h2 id="home-tour-title">{step.title}</h2>
        <p className="home-tour-description">{step.description}</p>

        <div className="home-tour-actions">
          <button
            className="home-tour-button home-tour-button-secondary"
            type="button"
            onClick={goBack}
            disabled={isFirst}
          >
            <ChevronLeft size={18} />
            Back
          </button>

          <a
            className="home-tour-manual-link"
            href={`${import.meta.env.BASE_URL}manual.pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Manual
          </a>

          <button
            className="home-tour-button home-tour-button-primary"
            type="button"
            onClick={goNext}
          >
            {isLast ? "Finish" : "Next"}
            {!isLast && <ChevronRight size={18} />}
          </button>
        </div>
      </section>
    </>,
    document.body
  );
}
