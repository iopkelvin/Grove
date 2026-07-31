import { useUser } from "../context/UserContext";
import Login from "../pages/Login";
import Home from "../pages/Home";

export default function AuthGate() {
  const { session, loading } = useUser();

  if (loading) return <div className="page">Loading...</div>;

  return session ? <Home /> : <Login />;
}