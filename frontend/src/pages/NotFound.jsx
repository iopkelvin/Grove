// 404.
//
// There was no catch-all route, so an unknown URL rendered nothing at all:
// a blank white page with the menu gone and no link back. A typo'd or stale
// bookmark looked exactly like a crash.

import { Link } from "react-router-dom";

import MenuIcon from "../components/MenuIcon";
import { useUser } from "../context/UserContext";

export default function NotFound() {
  const { isAuthenticated } = useUser();

  return (
    <div className="page">
      {/* Only shown when signed in — the menu's links all lead somewhere
          that would immediately bounce a signed-out visitor to /login. */}
      {isAuthenticated && <MenuIcon />}
      <div className="page-content">
        <h1 className="page-title">This page does not exist</h1>
        <div className="card state state-empty">
          <p className="state-hint">
            The link may be out of date, or the address may have a typo in it.
          </p>
          <Link className="state-retry" to={isAuthenticated ? "/" : "/login"}>
            {isAuthenticated ? "Back to Grove" : "Go to login"}
          </Link>
        </div>
      </div>
    </div>
  );
}
