// Vitest environment setup.

import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  // jsdom implements neither matchMedia nor its event listeners, and
  // ThemeContext calls both on mount.
  //
  // Reinstalled unconditionally on every test, not just when it is absent:
  // the afterEach below restores all mocks, which leaves the previous
  // test's vi.fn() in place but with its implementation stripped. It then
  // returns undefined, and `matchMedia(...).matches` throws — so the first
  // test in a file passed and every subsequent one died.
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Any test that switches to fake timers must not leave them on: the next
  // test's userEvent would then wait on a clock nothing advances and hang
  // the whole run.
  vi.useRealTimers();
});
