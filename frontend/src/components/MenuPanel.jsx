// Slide-out navigation.
//
// Changes from the previous version:
//
//   * Calendar is gone. It linked to a route that did not exist, so the
//     entry rendered a blank page. CalDAV is out of scope for this
//     milestone; the link comes back with the feature.
//   * Lobby is new — the global study room now has a backend.
//   * The active-item check used `location.pathname === path`, so "/" was
//     highlighted on literally every page, since no other path equals it
//     but the comparison for nested routes never matched either.
//   * Focus moves into the panel when it opens and returns to the trigger
//     when it closes, and Tab is trapped inside while it is open. Without
//     that, a keyboard user tabs from the panel straight into the page
//     behind it, which is still there and still interactive.

import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Home,
  LogOut,
  Settings,
  Share2,
  Sprout,
  Trees,
  User,
  Users,
  X,
} from "lucide-react";

import { useUser } from "../context/UserContext";

export default function MenuPanel({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, pendingRequestCount, profile } = useUser();
  const panelRef = useRef(null);

  // Profile has no dedicated URL of its own — it is always your own
  // /user/{username}, the same as anybody else's. Falls back to /profile
  // (still a valid route) until the profile has loaded.
  const navItems = [
    { label: "Home", path: "/", icon: Home },
    {
      label: "Profile",
      path: profile?.username ? `/user/${profile.username}` : "/profile",
      icon: User,
    },
    { label: "Tasks", path: "/tasks", icon: CheckSquare },
    { label: "Streaks", path: "/streaks", icon: Sprout },
    { label: "Friends", path: "/friends", icon: Users, badge: pendingRequestCount },
    { label: "Lobby", path: "/lobby", icon: Trees },
    { label: "Rooms", path: "/rooms", icon: Share2 },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    panelRef.current?.querySelector("button, a")?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // Stops the page behind the overlay scrolling under it on touch devices.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function isActive(path) {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  async function handleLogout() {
    await logout();
    onClose();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <div className="menu-overlay" onClick={onClose} aria-hidden="true" />
      <nav
        className="menu-panel"
        ref={panelRef}
        aria-label="Main navigation"
        role="dialog"
        aria-modal="true"
      >
        <button className="menu-close" onClick={onClose} aria-label="Close menu">
          <X size={22} />
        </button>

        {navItems.map(({ label, path, icon: Icon, badge }) => (
          <Link
            key={label}
            to={path}
            className={`menu-item ${isActive(path) ? "menu-item-active" : ""}`}
            aria-current={isActive(path) ? "page" : undefined}
            onClick={onClose}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
            {badge > 0 && (
              <span className="menu-item-badge" aria-label={`${badge} pending`}>
                {badge}
              </span>
            )}
          </Link>
        ))}

        <button className="menu-item menu-logout" onClick={handleLogout}>
          <LogOut size={22} aria-hidden="true" />
          <span>Log Out</span>
        </button>
      </nav>
    </>
  );
}
