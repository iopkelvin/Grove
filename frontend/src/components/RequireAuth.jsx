// Route guard.
//
// The old component named RequireAuth required nothing: it rendered <Home />
// or <Login /> for the "/" route and was not applied to any other route at
// all. /tasks, /friends and /profile were reachable while signed out, where
// they rendered against a null session and either showed an empty page or
// threw.
//
// This wraps the authenticated routes properly and remembers where the user
// was headed, so logging in returns them there instead of dumping them on
// the home page.

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useUser } from "../context/UserContext";
import { LoadingState } from "./states";

export default function RequireAuth() {
  const { isAuthenticated, loading } = useUser();
  const location = useLocation();

  // Redirecting while the session is still resolving would bounce every
  // signed-in user to /login on a hard refresh.
  if (loading) {
    return (
      <div className="page">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** The inverse: keep a signed-in user off the login and signup pages. */
export function RedirectIfAuthenticated() {
  const { isAuthenticated, loading } = useUser();

  if (loading) {
    return (
      <div className="page">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}
