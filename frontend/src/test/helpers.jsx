// Shared test helpers.

import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { ThemeProvider } from "../context/ThemeContext";

/**
 * A stand-in for the whole UserContext.
 *
 * Tests import the real `useUser` through a module mock rather than
 * rendering the real provider, so nothing has to stub Supabase's auth
 * client just to render a card.
 */
export function makeUserContext(overrides = {}) {
  return {
    session: { user: { id: "supabase-1", email: "kelvin@berkeley.edu" } },
    loading: false,
    isAuthenticated: true,
    profile: {
      id: 1,
      username: "kelvin",
      display_name: "Kelvin Chen",
      first_name: "kelvin",
      last_name: "chen",
      email: "kelvin@berkeley.edu",
      current_streak: 3,
      longest_streak: 5,
      show_online_status: true,
    },
    profileError: null,
    friendsSummary: { total: 0, online: 0, pending_incoming: 0 },
    pendingRequestCount: 0,
    logout: vi.fn(),
    updateProfile: vi.fn(),
    refreshProfile: vi.fn(),
    refreshFriendsSummary: vi.fn(),
    ...overrides,
  };
}

/** Render inside the providers every page assumes are present. */
export function renderWithProviders(ui, { route = "/" } = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

/** A Response-alike for stubbing global fetch. */
export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        ({ "content-type": "application/json", ...headers })[name.toLowerCase()] ?? null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
