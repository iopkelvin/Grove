import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Music, MessageCircle, Plus, Trash2, X } from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { useUser } from "../context/UserContext";
import { getFriends } from "../api/friends";
import { getTasks } from "../api/tasks";
import { createRoom, deleteRoom, getRooms, leaveRoom, roomImageFor } from "../api/rooms";
import { firstNameOf } from "../lib/format";

function CreateRoomModal({ friends, onClose, onCreate, creating, error }) {
  const [name, setName] = useState("My Study Room");
  const [setting, setSetting] = useState("campsite");
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [focusMinutes, setFocusMinutes] = useState(50);

  const filteredFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((friend) =>
      `${friend.display_name || ""} ${friend.username || ""}`.toLowerCase().includes(query)
    );
  }, [friendSearch, friends]);

  function toggleFriend(friendId) {
    setSelectedFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  }

  function submit(e) {
    e.preventDefault();
    onCreate({
      name,
      setting,
      music_enabled: musicEnabled,
      chat_enabled: chatEnabled,
      focus_minutes: focusMinutes,
      invite_user_ids: selectedFriendIds,
    });
  }

  return (
    <div className="study-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="study-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="study-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <p className="study-eyebrow">New room</p>
        <h2 id="create-room-title">Create your own study room</h2>

        <form className="study-room-form" onSubmit={submit}>
          <label>
            Room name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>

          <div className="study-form-row">
            <label>
              Map
              <select value={setting} onChange={(event) => setSetting(event.target.value)}>
                <option value="campsite">Campsite</option>
                <option value="mars">Mars</option>
                <option value="poker">Poker Table</option>
                <option value="library">Library</option>
              </select>
            </label>
            <label>
              Focus timer
              <select
                value={focusMinutes}
                onChange={(event) => setFocusMinutes(Number(event.target.value))}
              >
                <option value={25}>25 minutes</option>
                <option value={50}>50 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </label>
          </div>

          <fieldset className="study-friend-picker">
            <legend>Invite friends</legend>
            {friends.length === 0 ? (
              <p>No friends yet — add some from the Friends page.</p>
            ) : (
              <input
                type="search"
                placeholder="Search friends"
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
              />
            )}
            <div className="study-friend-options">
              {filteredFriends.map((friend) => (
                <label className="study-friend-option" key={friend.id}>
                  <input
                    type="checkbox"
                    checked={selectedFriendIds.includes(friend.id)}
                    onChange={() => toggleFriend(friend.id)}
                  />
                  <span className={`study-presence ${friend.is_online ? "is-online" : ""}`} />
                  <span>{friend.display_name || friend.username}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="study-toggle-grid">
            <label className="study-toggle-row">
              <span><Music size={18} /> Music</span>
              <input
                type="checkbox"
                checked={musicEnabled}
                onChange={(event) => setMusicEnabled(event.target.checked)}
              />
            </label>
            <label className="study-toggle-row">
              <span><MessageCircle size={18} /> Chat</span>
              <input
                type="checkbox"
                checked={chatEnabled}
                onChange={(event) => setChatEnabled(event.target.checked)}
              />
            </label>
          </div>

          {error && <p className="study-form-error">{error}</p>}
          <button className="study-primary-button" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create room"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Lobby() {
  const navigate = useNavigate();
  const { session, profile } = useUser();
  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return;

    Promise.allSettled([
      getRooms(supabaseId),
      getTasks(supabaseId, { completed: false }),
      getFriends(supabaseId),
    ]).then(([roomResult, taskResult, friendResult]) => {
      if (roomResult.status === "fulfilled") setRooms(roomResult.value);
      if (taskResult.status === "fulfilled") setTasks(taskResult.value);
      if (friendResult.status === "fulfilled") {
        setFriends(friendResult.value.map((entry) => entry.user));
      }
      if ([roomResult, taskResult, friendResult].some((result) => result.status === "rejected")) {
        setLoadError("Some content couldn't load. Try refreshing the page.");
      }
    });
  }, [session?.user?.id]);

  const firstName = firstNameOf(profile);

  // Router state carries `room` on navigation, but a page refresh loses it —
  // sessionStorage is the fallback Room.jsx reads from in that case.
  function openRoom(room) {
    sessionStorage.setItem(`grove-room-${room.id}`, JSON.stringify(room));
    navigate(`/rooms/${room.id}`, { state: { room } });
  }

  async function handleDeleteRoom(roomId) {
    if (!window.confirm("Delete this room? This can't be undone.")) return;
    try {
      await deleteRoom(roomId);
      setRooms((current) => current.filter((room) => room.id !== roomId));
    } catch (error) {
      setLoadError(error.message);
    }
  }

  async function handleLeaveRoom(roomId) {
    try {
      await leaveRoom(roomId);
      setRooms((current) => current.filter((room) => room.id !== roomId));
    } catch (error) {
      setLoadError(error.message);
    }
  }

  async function handleCreateRoom(formValues) {
    setCreating(true);
    setCreateError("");

    try {
      let room;
      if (session?.user?.id) {
        room = await createRoom({
          host_supabase_id: session.user.id,
          name: formValues.name,
          setting: formValues.setting,
          music_enabled: formValues.music_enabled,
          chat_enabled: formValues.chat_enabled,
          focus_minutes: formValues.focus_minutes,
          invite_user_ids: formValues.invite_user_ids,
        });
      } else {
        // No session — preview the room locally instead of hitting the API.
        room = {
          ...formValues,
          id: `preview-${Date.now()}`,
          members: [{ id: profile?.id || "current-user", display_name: profile?.display_name || firstName }],
        };
      }

      setShowModal(false);
      openRoom(room);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page study-lobby-page">
      <MenuIcon />
      <main className="study-lobby-shell">
        <header className="study-lobby-header">
          <p className="study-eyebrow">Study rooms</p>
          <h1>Hi {firstName}, welcome to the study room!</h1>
          <p>Choose a room, invite friends, and make a little progress together.</p>
        </header>

        {loadError && <p className="study-form-error">{loadError}</p>}

        <section className="study-lobby-grid">
          <div className="study-room-section">
            <div className="study-section-heading">
              <div>
                <p className="study-eyebrow">Now studying</p>
                <h2>Current study rooms</h2>
              </div>
              <span>Scroll to explore</span>
            </div>

            {rooms.length === 0 ? (
              <p>No study rooms yet — create one below to get started.</p>
            ) : (
              <div className="study-room-wheel" aria-label="Available study rooms">
                {rooms.map((room) => (
                  <div className="study-room-card-wrap" key={room.id}>
                    <button className="study-room-card" onClick={() => openRoom(room)}>
                      <img src={roomImageFor(room)} alt="" />
                      <span className="study-room-card-overlay">
                        <strong>{room.name}</strong>
                        <small>{room.population ?? room.members?.length ?? 0} studying</small>
                      </span>
                      <ChevronRight className="study-room-arrow" size={22} />
                    </button>
                    {profile?.id === room.host_id && (
                      <button
                        type="button"
                        className="study-room-delete"
                        onClick={() => handleDeleteRoom(room.id)}
                        aria-label="Delete room"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {profile?.id !== room.host_id && !room.is_global && (
                      <button
                        type="button"
                        className="study-room-leave"
                        onClick={() => handleLeaveRoom(room.id)}
                        aria-label="Leave room"
                      >
                        <LogOut size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="study-task-section">
            <div className="study-section-heading">
              <div>
                <p className="study-eyebrow">Your list</p>
                <h2>Upcoming tasks</h2>
              </div>
              <span>{tasks.length} remaining</span>
            </div>
            {tasks.length === 0 ? (
              <p>No tasks yet.</p>
            ) : (
              <div className="study-task-scroll">
                {tasks.map((task) => (
                  <div className="study-task-row" key={task.id}>
                    <span className="study-task-dot" />
                    <span>{task.title}</span>
                    <strong>1 point</strong>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="study-create-section">
            <div className="study-section-heading">
              <div>
                <p className="study-eyebrow">Make it yours</p>
                <h2>Create your own study room</h2>
              </div>
            </div>
            <p className="study-create-copy">Invite friends and choose a map, focus timer, music, and chat.</p>
            {friends.length === 0 ? (
              <p>No friends yet — add some from the Friends page to invite them here.</p>
            ) : (
              <div className="study-friend-preview" aria-label="Friends available to invite">
                {friends.map((friend) => (
                  <div className="study-friend-preview-row" key={friend.id}>
                    <span className={`study-presence ${friend.is_online ? "is-online" : ""}`} />
                    <div>
                      <strong>{friend.display_name || friend.username}</strong>
                      <small>{friend.is_online ? "Online now" : "Ready for an invite"}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="study-primary-button study-create-button" onClick={() => setShowModal(true)}>
              <Plus size={20} /> Create a room
            </button>
          </section>
        </section>
      </main>

      {showModal && (
        <CreateRoomModal
          friends={friends}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateRoom}
          creating={creating}
          error={createError}
        />
      )}
    </div>
  );
}
