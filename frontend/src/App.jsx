// Routing (Kelvin)
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Friends from "./pages/Friends";
import AuthGate from "./components/RequireAuth";
import Tasks from "./pages/Tasks"; 
import Room from "./pages/Room";
import Streaks from "./pages/Streaks";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthGate />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/user/:username" element={<Profile />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/rooms" element={<Lobby />} />
        <Route path="/rooms/:roomId" element={<Room />} />
        <Route path="/streaks" element={<Streaks />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;