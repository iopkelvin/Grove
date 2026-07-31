// Sign up.
//
// The old flow had a real correctness bug. It called Supabase, then called
// /api/users/sync, then checked `if (!data.session)` — but the sync request
// was wrapped in a try/catch that only logged, so when it failed the user
// was navigated into an app where their Grove account did not exist. Every
// page then showed "User not found" with no way to recover short of
// deleting the Supabase user by hand.
//
// Now: a failed sync is a visible, retryable error, and the user is only
// sent onwards once their account genuinely exists.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { syncAccount } from "../api/users";
import ThemeToggle from "../components/ThemeToggle";
import { ApiError, messageFor } from "../lib/apiClient";
import { isSupabaseConfigured, supabase, supabaseConfigError } from "../lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  function validate() {
    const problems = {};
    if (!firstName.trim()) problems.first_name = "Enter your first name.";
    if (!lastName.trim()) problems.last_name = "Enter your last name.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      problems.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return problems;
  }

  async function handleSignup(event) {
    event.preventDefault();
    if (submitting) return;

    const problems = validate();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    const normalisedFirst = firstName.trim().toLowerCase();
    const normalisedLast = lastName.trim().toLowerCase();

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: normalisedFirst, last_name: normalisedLast } },
      });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      // With email confirmation enabled there is no session yet, so no token
      // to authenticate the sync call with. The account is created on first
      // login instead — hence the wording rather than a silent failure.
      if (!data.session) {
        setNotice(
          "Check your email to confirm your account, then log in. Your Grove profile is " +
            "created the first time you sign in."
        );
        return;
      }

      await syncAccount({
        firstName: normalisedFirst,
        lastName: normalisedLast,
        usernameSeed: email,
        email,
      });

      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(
        messageFor(
          err,
          "Your login was created but your Grove profile was not. Try logging in — it will " +
            "be created automatically."
        )
      );
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
        <h1 className="page-title">Sign Up</h1>

        {!isSupabaseConfigured && (
          <p className="auth-error" role="alert">
            {supabaseConfigError}
          </p>
        )}

        <form onSubmit={handleSignup} className="auth-form" noValidate>
          <label className="auth-field">
            First Name
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.first_name)}
              required
            />
            {fieldErrors.first_name && (
              <span className="field-error">{fieldErrors.first_name}</span>
            )}
          </label>

          <label className="auth-field">
            Last Name
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.last_name)}
              required
            />
            {fieldErrors.last_name && <span className="field-error">{fieldErrors.last_name}</span>}
          </label>

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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" disabled={submitting || !isSupabaseConfigured}>
            {submitting ? "Creating your account…" : "Sign Up"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
