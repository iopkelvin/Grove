// components/ThemeToggle.jsx
// Fixed moon/sun button, top-right of every page (mirrors MenuIcon on the left).
// Moon = currently light (click to go dark); Sun = currently dark.
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}