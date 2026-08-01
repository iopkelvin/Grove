import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../api/client";
import { useUser } from "../context/UserContext";
import { queueHomeTutorialAfterLogin } from "../hooks/useHomeTutorial";

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
      const res = await apiFetch("/api/users/sync", {
        method: "POST",
        body: JSON.stringify({
          supabase_id: data.user.id,
          email: data.user.email,
          username: data.user.email.split("@")[0],
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
        }),
      });
      if (!res.ok) throw new Error(`sync failed with status ${res.status}`);
      await refreshProfile(data.user.id);
    } catch (syncError) {
      console.error("Failed to sync user with backend:", syncError);
      setError("Something went wrong finishing your signup. Please try again.");
      return;
    }

    if (!data.session) {
      setError("Check your email to confirm your account before logging in.");
      return;
    }

    queueHomeTutorialAfterLogin();

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