import { useState } from "react";

import MenuPanel from "./MenuPanel";
import ThemeToggle from "./ThemeToggle";

// The hamburger, plus the dark-mode button the plan asks to sit "in the
// corner". Grouping them here means every page gets both from the one
// component it already rendered.
export default function MenuIcon() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="page-controls">
        <button
          className="menu-icon"
          aria-label="Open menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <ThemeToggle />
      </div>
      <MenuPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
