import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Music, MessageCircle, Plus, X } from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { useUser } from "../context/UserContext";
import { getFriends } from "../api/friends";
import { getTasks } from "../api/tasks";
import { createRoom, getRooms } from "../api/rooms";
import { capitalize } from "../lib/format";

// Shown only until the database has seeded public rooms and finished
// artwork for every map — keeps the lobby usable on a fresh DB.
const PLACEHOLDER_ROOMS = [
  {
    id: "campsite-61c",
    name: "61C Study Room",
    course: "CS 61C",
    setting: "campsite",
    image: "/assets/Study-Room.png",
    music_enabled: true,
    chat_enabled: true,
    focus_minutes: 50,
    members: [
      { id: "placeholder-jose", display_name: "Jose" },
      { id: "placeholder-jack", display_name: "Jack" },
      { id: "placeholder-jeff", display_name: "Jeff" },
      { id: "placeholder-john", display_name: "John" },
    ],
  },
  {
    id: "mars-160",
    name: "CS 160 Mars Lab",
    course: "CS 160",
    setting: "mars",
    image: "/assets/mars-placeholder.svg",
    music_enabled: false,
    chat_enabled: true,
    focus_minutes: 25,
    members: [
      { id: "placeholder-amy", display_name: "Amy" },
      { id: "placeholder-kelvin", display_name: "Kelvin" },
    ],
  },
  {
    id: "library-89",
    name: "Physics 89 Library",
    course: "PHYS 89",
    setting: "library",
    image: "/assets/library-placeholder.svg",
    music_enabled: true,
    chat_enabled: false,
    focus_minutes: 50,
    members: [{ id: "placeholder-mia", display_name: "Mia" }],
  },
];

// Shown only when the signed-in account has no accepted friends yet.
const PLACEHOLDER_FRIENDS = [
  { id: "placeholder-friend-1", display_name: "Jeff", username: "jeff", is_online: true },
  { id: "placeholder-friend-2", display_name: "John", username: "john", is_online: false },
  { id: "placeholder-friend-3", display_name: "Jack", username: "jack", is_online: true },
  { id: "placeholder-friend-4", display_name: "Julia", username: "julia", is_online: false },
];

// Shown only while the API is unavailable or before a user creates their
// first task.
const PLACEHOLDER_TASKS = [
  { id: "placeholder-task-1", title: "Finish your first Grove task", completed: false },
  { id: "placeholder-task-2", title: "Invite a friend to study", completed: false },
  { id: "placeholder-task-3", title: "Water your tree", completed: false },
];

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
      invite_user_ids: selectedFriendIds.filter((id) => Number.isInteger(id)),
      selected_placeholder_friends: friends.filter((friend) =>
        selectedFriendIds.includes(friend.id)
      ),
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
            <input
              type="search"
              placeholder="Search friends"
              value={friendSearch}
              onChange={(event) => setFriendSearch(event.target.value)}
            />
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

  useEffect(() => {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return;

    Promise.allSettled([
      getRooms(supabaseId),
      getTasks(supabaseId),
      getFriends(supabaseId),
    ]).then(([roomResult, taskResult, friendResult]) => {
      if (roomResult.status === "fulfilled") setRooms(roomResult.value);
      if (taskResult.status === "fulfilled") setTasks(taskResult.value);
      if (friendResult.status === "fulfilled") {
        setFriends(friendResult.value.map((entry) => entry.user));
      }
    });
  }, [session?.user?.id]);

  const displayedRooms = rooms.length ? rooms : PLACEHOLDER_ROOMS;
  const displayedTasks = tasks.length ? tasks : PLACEHOLDER_TASKS;
  const displayedFriends = friends.length ? friends : PLACEHOLDER_FRIENDS;
  const firstName = capitalize(profile?.first_name) || "there";

  // Router state carries `room` on navigation, but a page refresh loses it —
  // sessionStorage is the fallback Room.jsx reads from in that case.
  function openRoom(room) {
    sessionStorage.setItem(`grove-room-${room.id}`, JSON.stringify(room));
    navigate(`/rooms/${room.id}`, { state: { room } });
  }


// create room
//  checks errors
//  detects loaded friends
//  calls backend when user exists
//  checks time and user
//  adds user to the room
// async doc: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
// error catching: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch
// date now doc: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now
  async function handleCreateRoom(formValues) {
    setCreating(true);
    setCreateError("");

    try {
      let room;
      const hasOnlyPlaceholderFriends = formValues.selected_placeholder_friends.every(
        (friend) => typeof friend.id !== "number"
      );

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
      }

      // PLACEHOLDER MEMBERS: only included in the local preview when a fresh
      // account has no database friends yet. Real room members come from the API.
      if (!room || (hasOnlyPlaceholderFriends && room.members?.length <= 1)) {
        room = {
          ...formValues,
          id: room?.id ?? `preview-${Date.now()}`,
          members: [
            { id: profile?.id || "current-user", display_name: profile?.display_name || firstName },
            ...formValues.selected_placeholder_friends,
          ],
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

        <section className="study-lobby-grid">
          <div className="study-room-section">
            <div className="study-section-heading">
              <div>
                <p className="study-eyebrow">Now studying</p>
                <h2>Current study rooms</h2>
              </div>
              <span>Scroll to explore</span>
            </div>

            <div className="study-room-wheel" aria-label="Available study rooms">
              {displayedRooms.map((room) => {
                const image = room.image || (
                  room.setting === "mars"
                    ? "/assets/mars-placeholder.svg"
                    : room.setting === "library"
                      ? "/assets/library-placeholder.svg"
                      : "/assets/Study-Room.png"
                );
                return (
                  <button className="study-room-card" key={room.id} onClick={() => openRoom(room)}>
                    <img src={image} alt="" />
                    <span className="study-room-card-overlay">
                      <strong>{room.name}</strong>
                      <small>{room.population ?? room.members?.length ?? 0} studying</small>
                    </span>
                    <ChevronRight className="study-room-arrow" size={22} />
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="study-task-section">
            <div className="study-section-heading">
              <div>
                <p className="study-eyebrow">Your list</p>
                <h2>Upcoming tasks</h2>
              </div>
              <span>{displayedTasks.filter((task) => !task.completed).length} remaining</span>
            </div>
            <div className="study-task-scroll">
              {displayedTasks.map((task) => (
                <div className={`study-task-row ${task.completed ? "is-complete" : ""}`} key={task.id}>
                  <span className="study-task-dot" />
                  <span>{task.title}</span>
                  <strong>{task.completed ? "Done" : "1 point"}</strong>
                </div>
              ))}
            </div>
          </aside>

          <section className="study-create-section">
            <div className="study-section-heading">
              <div>
                <p className="study-eyebrow">Make it yours</p>
                <h2>Create your own study room</h2>
              </div>
            </div>
            <p className="study-create-copy">Invite friends and choose a map, focus timer, music, and chat.</p>
            <div className="study-friend-preview" aria-label="Friends available to invite">
              {displayedFriends.map((friend) => (
                <div className="study-friend-preview-row" key={friend.id}>
                  <span className={`study-presence ${friend.is_online ? "is-online" : ""}`} />
                  <div>
                    <strong>{friend.display_name || friend.username}</strong>
                    <small>{friend.is_online ? "Online now" : "Ready for an invite"}</small>
                  </div>
                </div>
              ))}
            </div>
            <button className="study-primary-button study-create-button" onClick={() => setShowModal(true)}>
              <Plus size={20} /> Create a room
            </button>
          </section>
        </section>
      </main>

      {showModal && (
        <CreateRoomModal
          friends={displayedFriends}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateRoom}
          creating={creating}
          error={createError}
        />
      )}
    </div>
  );
}
