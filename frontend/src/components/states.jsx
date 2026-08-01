// Loading, empty and error states.
//
// The rubric asks for "clear navigation, validation, loading, confirmation,
// error, and empty states". Before this, loading was the string "Loading..."
// hand-written on five pages, empty was a bare <p>, and error was nothing at
// all — failures went to console.error and the user saw the empty state,
// which told them their data did not exist rather than that it could not be
// fetched.
//
// Four small components so every page says the same thing the same way.

import { AlertCircle, Inbox, Loader2, WifiOff } from "lucide-react";

import { ApiError } from "../lib/apiClient";

/** Spinner with text. `label` is announced to screen readers. */
export function LoadingState({ label = "Loading", inline = false }) {
  return (
    <div className={inline ? "state state-inline" : "state"} role="status" aria-live="polite">
      <Loader2 className="state-spinner" size={inline ? 18 : 28} aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

/**
 * Nothing here yet — and why that is fine.
 *
 * Distinct from ErrorState on purpose: "you have no tasks" and "we could not
 * load your tasks" look identical to a user unless the UI insists otherwise.
 */
export function EmptyState({ title, hint, icon: Icon = Inbox, action = null }) {
  return (
    <div className="state state-empty">
      <Icon size={28} aria-hidden="true" />
      <p className="state-title">{title}</p>
      {hint && <p className="state-hint">{hint}</p>}
      {action}
    </div>
  );
}

/**
 * Something failed. Shows what, and offers a way out.
 *
 * A connection failure gets a different icon and wording from a server
 * error, because "check your connection" is actionable and "something went
 * wrong" is not.
 */
export function ErrorState({ error, onRetry, title }) {
  const isOffline = error instanceof ApiError && error.isNetworkError;
  const message =
    error instanceof ApiError ? error.message : "Something went wrong. Please try again.";

  return (
    <div className="state state-error" role="alert">
      {isOffline ? (
        <WifiOff size={28} aria-hidden="true" />
      ) : (
        <AlertCircle size={28} aria-hidden="true" />
      )}
      <p className="state-title">{title || (isOffline ? "You appear to be offline" : "That did not work")}</p>
      <p className="state-hint">{message}</p>
      {onRetry && (
        <button type="button" className="state-retry" onClick={onRetry}>
          Try again
        </button>
      )}
      {/* The id the server logged this failure under. Pasting it into a bug
          report turns "it broke" into one greppable trace. */}
      {error instanceof ApiError && error.requestId && (
        <p className="state-meta">Reference: {error.requestId}</p>
      )}
    </div>
  );
}

/**
 * The loading / error / empty decision, made once.
 *
 * Pages pass their three pieces of state and their content; the ordering —
 * error beats loading beats empty — is then guaranteed to be the same
 * everywhere.
 */
export function AsyncBoundary({
  loading,
  error,
  isEmpty = false,
  onRetry,
  loadingLabel,
  empty = null,
  children,
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading) return <LoadingState label={loadingLabel} />;
  if (isEmpty && empty) return empty;
  return children;
}
