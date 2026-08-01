// Log in.
//
// Fixes: the submit button could be pressed repeatedly while the request was
// in flight, there was no busy state at all, and a successful login always
// navigated to "/" even when the user had been redirected here from
// somewhere else. There was also no handling for the single most common
// setup failure — Supabase not configured — which surfaced as a blank page.

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import ThemeToggle from "../components/ThemeToggle";
import { isSupabaseConfigured, supabase, supabaseConfigError } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // RequireAuth stores where the user was heading before being bounced here.
  const destination = location.state?.from?.pathname || "/";

  async function handleLogin(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError(loginError.message);
        return;
      }
      navigate(destination, { replace: true });
    } catch {
      setError("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="page-controls">
        <ThemeToggle />
      </div>

      <div className="auth-card card">
        <h1 className="page-title">Log In</h1>

        {!isSupabaseConfigured && (
          <p className="auth-error" role="alert">
            {supabaseConfigError}
          </p>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <label className="auth-field">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting || !isSupabaseConfigured}>
            {submitting ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
