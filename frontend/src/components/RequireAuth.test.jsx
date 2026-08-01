// The route guard. Before this component did anything, /tasks, /friends and
// /profile were all reachable while signed out.

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { makeUserContext } from "../test/helpers";

const mockUser = vi.fn();
vi.mock("../context/UserContext", () => ({ useUser: () => mockUser() }));

const { default: RequireAuth, RedirectIfAuthenticated } = await import("./RequireAuth");

/**
 * A miniature app: /tasks behind RequireAuth, /login behind
 * RedirectIfAuthenticated, / open to everyone.
 *
 * The two guarded groups must not overlap. An earlier version of this
 * helper put /login inside the RequireAuth group as well, so a signed-out
 * request for /tasks redirected to /login, which the guard then matched
 * again and redirected again — an infinite loop that hung the whole test
 * run rather than failing it.
 */
function renderApp(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/tasks" element={<p>protected content</p>} />
        </Route>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/login" element={<p>login page</p>} />
        </Route>
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  it("renders the page for a signed-in user", () => {
    mockUser.mockReturnValue(makeUserContext());

    renderApp("/tasks");

    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("redirects a signed-out visitor to login", () => {
    mockUser.mockReturnValue(makeUserContext({ session: null, isAuthenticated: false }));

    renderApp("/tasks");

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("waits rather than redirecting while the session is resolving", () => {
    // Redirecting here would bounce every signed-in user to /login on a
    // hard refresh, before Supabase has restored the session.
    mockUser.mockReturnValue(
      makeUserContext({ loading: true, session: null, isAuthenticated: false })
    );

    renderApp("/tasks");

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });
});

describe("RedirectIfAuthenticated", () => {
  it("keeps a signed-in user off the login page", () => {
    mockUser.mockReturnValue(makeUserContext());

    renderApp("/login");

    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("lets a signed-out visitor through", () => {
    mockUser.mockReturnValue(makeUserContext({ session: null, isAuthenticated: false }));

    renderApp("/login");

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("waits while the session is resolving", () => {
    mockUser.mockReturnValue(
      makeUserContext({ loading: true, session: null, isAuthenticated: false })
    );

    renderApp("/login");

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
