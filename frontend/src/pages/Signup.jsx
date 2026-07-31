import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refreshProfile } = useUser();

  async function handleSignup(e) {
    e.preventDefault();
    setError("");

    const normalizedFirstName = firstName.trim().toLowerCase();
    const normalizedLastName = lastName.trim().toLowerCase();

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: normalizedFirstName, last_name: normalizedLastName },
      },
    });

    if (signupError) {
      setError(signupError.message);
      return;
    }

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_id: data.user.id,
          email: data.user.email,
          username: data.user.email.split("@")[0],
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
        }),
      });
      await refreshProfile(data.user.id);
    } catch (syncError) {
      console.error("Failed to sync user with backend:", syncError);
    }

    navigate("/");
  }

  return (
    <div className="page auth-page">
      <div className="auth-card card">
        <h1 className="page-title">Sign Up</h1>
        <form onSubmit={handleSignup} className="auth-form">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Sign Up</button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;