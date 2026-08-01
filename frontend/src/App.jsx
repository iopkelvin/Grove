import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Friends from "./pages/Friends";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Lobby from "./pages/Lobby";
import Room from "./pages/Room";
import Streaks from "./pages/Streaks";
import Settings from "./pages/Settings";
import AuthGate from "./components/RequireAuth";
import ThemeToggle from "./components/ThemeToggle";

function App() {
  return (
    <BrowserRouter>
          <ThemeToggle />
      <Routes>
        <Route path="/" element={<AuthGate />} />
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/user/:username" element={<Profile />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/rooms" element={<Lobby />} />
        <Route path="/rooms/:roomId" element={<Room />} />
        <Route path="/streaks" element={<Streaks />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;