// Study rooms you host or belong to.
//
// New page. The plan's "Rooms Page — implement user study rooms" item, which
// had neither a frontend nor a backend: POST /api/rooms was a stub that
// answered 500.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users } from "lucide-react";

import { createRoom, getRooms } from "../api/rooms";
import PageLayout from "../components/PageLayout";
import { AsyncBoundary, EmptyState } from "../components/states";
import { ApiError, messageFor } from "../lib/apiClient";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("grove");
  const [capacity, setCapacity] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRooms();
      setRooms(data.items);
      setThemes(data.themes);
      // Themes come from the backend rather than being hard-coded here, so
      // the two cannot drift into disagreeing about what is valid.
      if (data.themes?.length && !data.themes.includes(theme)) setTheme(data.themes[0]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // `theme` is deliberately excluded: including it would reload the list
    // every time the user changed the dropdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});

    try {
      await createRoom({
        name,
        theme,
        capacity: capacity ? Number(capacity) : undefined,
      });
      setName("");
      setCapacity("");
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setFormError(messageFor(err, "Could not create the room."));
    } finally {
      setSaving(false);
    }
  }

  const hosted = rooms.filter((room) => !room.is_global);

  return (
    <PageLayout
      title="Study Rooms"
      subtitle="Small rooms for a group. The Grove is the one everybody shares."
      actions={
        <button type="button" className="primary-button" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} aria-hidden="true" />
          {showForm ? "Cancel" : "New room"}
        </button>
      }
    >
      <AsyncBoundary loading={loading} error={error} onRetry={load} loadingLabel="Loading rooms">
        {showForm && (
          <form className="card room-form" onSubmit={handleCreate}>
            <label>
              Room name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="CS160 crunch"
                required
                maxLength={120}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>

            <label>
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                {themes.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Capacity <span className="field-hint">optional</span>
              <input
                type="number"
                min="1"
                max="50"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                placeholder="No limit"
                aria-invalid={Boolean(fieldErrors.capacity)}
              />
              {fieldErrors.capacity && <span className="field-error">{fieldErrors.capacity}</span>}
            </label>

            {formError && (
              <p className="auth-error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Creating…" : "Create room"}
            </button>
          </form>
        )}

        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>

        {hosted.length === 0 && !showForm && (
          <EmptyState
            title="You have no rooms of your own yet"
            hint="Create one for a study group, or join The Grove above."
            icon={Users}
          />
        )}
      </AsyncBoundary>
    </PageLayout>
  );
}

function RoomCard({ room }) {
  const destination = room.is_global ? "/lobby" : `/rooms/${room.id}`;

  return (
    <Link to={destination} className={`card room-card room-card-${room.theme}`}>
      <h2 className="room-card-name">{room.name}</h2>
      <p className="room-card-meta">
        <Users size={14} aria-hidden="true" />
        {room.population} here
        {room.capacity ? ` · up to ${room.capacity}` : ""}
      </p>
      {room.is_global && <span className="room-card-badge">Everyone</span>}
      {room.is_full && <span className="room-card-badge">Full</span>}
    </Link>
  );
}
