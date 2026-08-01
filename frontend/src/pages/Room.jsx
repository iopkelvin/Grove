// A single study room.
//
// This file was zero bytes. GET /api/rooms/<id> was a `pass`-bodied stub.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogIn, LogOut, Trash2, Users } from "lucide-react";

import { closeRoom, getRoom, joinRoom, leaveRoom } from "../api/rooms";
import PageLayout from "../components/PageLayout";
import PresenceGrove from "../components/PresenceGrove";
import { AsyncBoundary } from "../components/states";
import { messageFor } from "../lib/apiClient";

const POLL_INTERVAL_MS = 30000;

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const next = await getRoom(roomId);
        if (!mounted.current) return;
        setState(next);
        setError(null);
      } catch (err) {
        if (!mounted.current || silent) return;
        setError(err);
      } finally {
        if (mounted.current && !silent) setLoading(false);
      }
    },
    [roomId]
  );

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
      const next = state?.joined ? await leaveRoom(roomId) : await joinRoom(roomId);
      setState((previous) => ({ ...previous, ...next }));
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    setActionError("");
    try {
      await closeRoom(roomId);
      navigate("/rooms", { replace: true });
    } catch (err) {
      setActionError(messageFor(err));
      setBusy(false);
    }
  }

  const room = state?.room;

  return (
    <PageLayout
      title={room?.name || "Study room"}
      subtitle={room?.host_username ? `Hosted by ${room.host_username}` : undefined}
      actions={
        state && (
          <button
            type="button"
            className="primary-button"
            onClick={toggleMembership}
            disabled={busy || (!state.joined && room?.is_full)}
          >
            {state.joined ? <LogOut size={16} /> : <LogIn size={16} />}
            {state.joined ? "Leave" : room?.is_full ? "Room is full" : "Join"}
          </button>
        )
      }
    >
      <AsyncBoundary loading={loading} error={error} onRetry={load} loadingLabel="Opening the room">
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
                <strong>{room.population}</strong>
                {room.capacity ? ` of ${room.capacity}` : ""}{" "}
                {room.population === 1 ? "person is" : "people are"} here
              </span>
            </div>

            <PresenceGrove
              members={room.members}
              theme={room.theme}
              emptyMessage="This room is quiet. Join to start it off."
            />

            <section className="card room-roster">
              <h2 className="card-title">Who is here</h2>
              {room.members.length === 0 ? (
                <p className="state-hint">Nobody is in this room right now.</p>
              ) : (
                <ul className="room-roster-list">
                  {room.members.map((member) => (
                    <li key={member.id}>
                      <Link to={`/user/${member.username}`}>
                        {member.display_name || member.username}
                      </Link>
                      <span className="room-roster-streak">
                        {member.current_streak} day{member.current_streak === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Closing a room removes it for everyone in it, so it asks
                first rather than acting on a single click. */}
            {state.is_host && (
              <div className="room-danger">
                {confirmingClose ? (
                  <>
                    <p>Close this room? Everyone in it will be removed.</p>
                    <div className="room-danger-actions">
                      <button type="button" onClick={handleClose} disabled={busy}>
                        Yes, close it
                      </button>
                      <button type="button" onClick={() => setConfirmingClose(false)}>
                        Keep it open
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmingClose(true)}>
                    <Trash2 size={16} aria-hidden="true" />
                    Close room
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </AsyncBoundary>
    </PageLayout>
  );
}
