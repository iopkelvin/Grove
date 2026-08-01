// The global study room.
//
// This file was zero bytes and there was no /lobby route. On the backend,
// GET /api/rooms answered 500 because the view had a `pass` body — so there
// was nothing to build a page against either.
//
// Presence is polled rather than pushed. Websockets would be better, and
// are not worth a second process type and a broker for a room that changes
// every few minutes; the poll interval is well under the five-minute window
// the backend uses to decide who counts as online.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogIn, LogOut, Users } from "lucide-react";

import { getLobby, joinLobby, leaveLobby } from "../api/rooms";
import PageLayout from "../components/PageLayout";
import PresenceGrove from "../components/PresenceGrove";
import { AsyncBoundary } from "../components/states";
import { messageFor } from "../lib/apiClient";

const POLL_INTERVAL_MS = 30000;

export default function Lobby() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const next = await getLobby();
      if (!mounted.current) return;
      setState(next);
      setError(null);
    } catch (err) {
      // A failed background refresh must not replace a room the user is
      // looking at with an error screen; only the first load can do that.
      if (!mounted.current) return;
      if (!silent) setError(err);
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function toggleMembership() {
    setBusy(true);
    setActionError("");
    try {
      setState(state?.joined ? await leaveLobby() : await joinLobby());
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const room = state?.room;

  return (
    <PageLayout
      title="The Grove"
      subtitle="One shared room. Everyone studying right now is in it."
      actions={
        state && (
          <button
            type="button"
            className="primary-button"
            onClick={toggleMembership}
            disabled={busy}
          >
            {state.joined ? <LogOut size={16} /> : <LogIn size={16} />}
            {busy ? "Working…" : state.joined ? "Leave" : "Join the grove"}
          </button>
        )
      }
    >
      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={load}
        loadingLabel="Opening the grove"
      >
        {room && (
          <>
            {actionError && (
              <p className="auth-error" role="alert">
                {actionError}
              </p>
            )}

            <div className="room-population">
              <Users size={18} aria-hidden="true" />
              <span>
                <strong>{room.population}</strong>{" "}
                {room.population === 1 ? "person is" : "people are"} here
              </span>
            </div>

            <PresenceGrove members={room.members} theme={room.theme} />

            <section className="card room-roster">
              <h2 className="card-title">Who is here</h2>
              {room.members.length === 0 ? (
                <p className="state-hint">
                  Nobody yet. Join and your tree will be the first one growing.
                </p>
              ) : (
                <ul className="room-roster-list">
                  {room.members.map((member) => (
                    <li key={member.id}>
                      <Link to={`/user/${member.username}`}>
                        {member.display_name || member.username}
                      </Link>
                      <span className="room-roster-streak">
                        {member.current_streak} day
                        {member.current_streak === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </AsyncBoundary>
    </PageLayout>
  );
}
