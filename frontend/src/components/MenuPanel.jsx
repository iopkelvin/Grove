import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Home, User, Users, CheckSquare, Share2, Calendar, Sprout, Settings } from "lucide-react";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Friends", path: "/friends", icon: Users },
  { label: "Tasks", path: "/tasks", icon: CheckSquare },
  { label: "Rooms", path: "/rooms", icon: Share2 },
  { label: "Calendar", path: "/calendar", icon: Calendar },
  { label: "Streaks", path: "/streaks", icon: Sprout },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function MenuPanel({ isOpen, onClose }) {
  const location = useLocation();

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="menu-overlay" onClick={onClose} />
      <nav className="menu-panel">
        <button className="menu-close" onClick={onClose} aria-label="Close menu">
          <X size={22} />
        </button>

        {navItems.map(({ label, path, icon: Icon }) => (
          <Link
            key={label}
            to={path}
            className={`menu-item ${location.pathname === path ? "menu-item-active" : ""}`}
            onClick={onClose}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}