// Routing.
//
// Every page in the menu now has a route. Before this, the menu linked to
// /rooms, /calendar, /streaks and /settings, none of which were registered —
// clicking any of them rendered a blank page with no error and no way back
// except the browser's back button. The four page files those routes needed
// existed and were zero bytes.
//
// Routes are grouped by who may see them:
//
//   public         login, signup, and anyone's public profile
//   authenticated  everything else, behind <RequireAuth>
//
// Calendar is deliberately absent: CalDAV integration is out of scope for
// this milestone and is tracked as a stretch goal.

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ErrorBoundary from "./components/ErrorBoundary";
import RequireAuth, { RedirectIfAuthenticated } from "./components/RequireAuth";
import Friends from "./pages/Friends";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Room from "./pages/Room";
import Rooms from "./pages/Rooms";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";
import Streaks from "./pages/Streaks";
import Tasks from "./pages/Tasks";

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route element={<RedirectIfAuthenticated />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route path="/user/:username" element={<Profile />} />

          {/* Authenticated */}
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/streaks" element={<Streaks />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/rooms/:roomId" element={<Room />} />
            <Route path="/settings" element={<Settings />} />
            {/* The menu used to point here before Home had its own path. */}
            <Route path="/home" element={<Navigate to="/" replace />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
