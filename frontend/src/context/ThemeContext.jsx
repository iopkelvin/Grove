// Light / dark theme.
//
// The development plan lists dark mode as a stretch goal. It is implemented
// entirely in CSS custom properties: this provider only sets data-theme on
// <html>, and styles/theme.css redefines the colour tokens underneath that
// attribute. No component knows which theme is active, which is why adding
// dark mode required no changes to any of them.
//
// Three states rather than two. "system" is the default and follows the OS
// setting live; choosing light or dark pins it and persists that choice.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "grove:theme";
export const THEME_OPTIONS = ["system", "light", "dark"];

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEME_OPTIONS.includes(stored) ? stored : "system";
  } catch {
    // Safari in private mode throws on localStorage access.
    return "system";
  }
}

function prefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredTheme);
  const [systemIsDark, setSystemIsDark] = useState(prefersDark);

  // Follow the OS while the preference is "system", so changing the system
  // theme updates the app without a reload.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;

    const onChange = (event) => setSystemIsDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = preference === "system" ? (systemIsDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    // Tells the browser to render form controls and scrollbars to match,
    // which is the difference between "dark mode" and "dark mode with a
    // blinding white select box".
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((next) => {
    if (!THEME_OPTIONS.includes(next)) return;
    setPreference(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ preference, theme: resolved, isDark: resolved === "dark", setTheme, toggleTheme }),
    [preference, resolved, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used inside a <ThemeProvider>");
  }
  return context;
}
