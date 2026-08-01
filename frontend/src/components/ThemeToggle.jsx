// Light / dark switch.
//
// The development plan wants a "button in corner to turn Dark Mode on and
// off". This is that button; the Settings page offers the three-way choice
// including "match my system".

import { Moon, Sun } from "lucide-react";

import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      // The label states the action, not the current state: a screen reader
      // user needs to know what pressing it does.
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
