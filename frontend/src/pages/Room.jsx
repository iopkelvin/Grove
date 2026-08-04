import { Fragment, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Image as ImageIcon,
  MessageCircle,
  Music,
  Pause,
  Play,
  RotateCcw,
  Send,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabaseClient";
import { uploadRoomWallpaper } from "../lib/uploadImage";
import { isSameDay } from "../utils/date";
import { getFriends } from "../api/friends";
import {
  getRoom,
  visitRoom,
  deleteRoom,
  roomImageFor,
  roomSoundFor,
  setRoomWallpaper,
  setRoomSetting,
  ROOM_SETTING_KEYS,
  inviteRoomMembers,
  removeRoomMember,
  getRoomMessages,
  sendRoomMessage,
} from "../api/rooms";

// Percentage-based so marker placement holds up across screen resolutions.
const MEMBER_POSITIONS = [
  { left: "29%", top: "50%" },
  { left: "48%", top: "38%" },
  { left: "67%", top: "47%" },
  { left: "60%", top: "68%" },
  { left: "39%", top: "67%" },
  { left: "76%", top: "61%" },
];

// Realtime delivers new messages instantly; this is just a fallback resync
// in case a connection drops silently.
const CHAT_RESYNC_INTERVAL_MS = 20000;
const MAX_DISPLAYED_MESSAGES = 100;

// Real rooms have numeric ids; a locally-previewed room (no session, see
// Lobby.jsx) has a "preview-<timestamp>" id and skips server-backed features.
function isRealRoomId(id) {
  return /^\d+$/.test(String(id));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Label for a chat date separator — shown once whenever the thread crosses
// into a new calendar day, so a long-running conversation stays readable.
function formatMessageDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session, profile } = useUser();
  const [room, setRoom] = useState(location.state?.room || null);
  const [loadError, setLoadError] = useState("");
  const [running, setRunning] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(location.state?.room?.music_enabled ?? true);
  const [volume, setVolume] = useState(0.5);
  const [secondsRemaining, setSecondsRemaining] = useState((room?.focus_minutes || 50) * 60);
  const audioRef = useRef(null);

  const [wallpaperPanelOpen, setWallpaperPanelOpen] = useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [wallpaperError, setWallpaperError] = useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatError, setChatError] = useState("");
  const lastMessageIdRef = useRef(null);

  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    if (room) return;

    const saved = sessionStorage.getItem(`grove-room-${roomId}`);
    if (saved) {
      try {
        setRoom(JSON.parse(saved));
        return;
      } catch {
        sessionStorage.removeItem(`grove-room-${roomId}`);
      }
    }

    if (isRealRoomId(roomId)) {
      getRoom(roomId).then(setRoom).catch(() => setLoadError("This room couldn't be loaded."));
    } else {
      setLoadError("This room couldn't be found.");
    }
  }, [room, roomId]);

  // Recorded for the Home page's "continue where you left off" widget.
  // Independent of the room-resolution effect above so it still fires when
  // the room came from the sessionStorage/location.state cache.
  useEffect(() => {
    if (isRealRoomId(roomId)) {
      visitRoom(roomId).catch((error) => console.error("Failed to record room visit:", error));
    }
  }, [roomId]);

  useEffect(() => {
    if (!room) return;
    setMusicEnabled(room.music_enabled ?? true);
    setSecondsRemaining((room.focus_minutes || 50) * 60);
  }, [room?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicEnabled) {
      // .load() picks up the new <audio src> when the setting (and so the
      // ambient track) changes — browsers don't reliably do this on their
      // own from a src-attribute change alone.
      audio.load();
      // Autoplay needs a real user gesture; flip the toggle back off
      // instead of claiming to play when the browser blocked it.
      audio.play().catch(() => setMusicEnabled(false));
    } else {
      audio.pause();
    }
  }, [musicEnabled, room?.setting]);

  useEffect(() => {
    if (!running || secondsRemaining <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsRemaining]);

  // Realtime just triggers a refetch — the INSERT payload lacks the joined
  // sender name, so messages still come from the REST endpoint.
  useEffect(() => {
    if (!room || !room.chat_enabled || !chatOpen || !isRealRoomId(room.id)) return undefined;

    let cancelled = false;

    async function fetchNewMessages() {
      try {
        const fresh = await getRoomMessages(room.id, lastMessageIdRef.current);
        if (cancelled || fresh.length === 0) return;
        setMessages((current) => [...current, ...fresh].slice(-MAX_DISPLAYED_MESSAGES));
        lastMessageIdRef.current = fresh[fresh.length - 1].id;
      } catch (error) {
        console.error("Failed to fetch new room messages:", error);
      }
    }

    getRoomMessages(room.id)
      .then((initial) => {
        if (cancelled) return;
        setMessages(initial);
        if (initial.length) lastMessageIdRef.current = initial[initial.length - 1].id;
      })
      .catch((error) => console.error("Failed to load room messages:", error));

    const channel = supabase
      .channel(`room-${room.id}-messages`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        fetchNewMessages
      )
      .subscribe();

    const interval = window.setInterval(fetchNewMessages, CHAT_RESYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [room?.id, room?.chat_enabled, chatOpen]);

  useEffect(() => {
    if (!invitePanelOpen || !session?.user?.id) return;
    getFriends(session.user.id, { status: "accepted" })
      .then(setFriends)
      .catch((error) => console.error("Failed to load friends:", error));
  }, [invitePanelOpen, session?.user?.id]);

  async function handleSendMessage(event) {
    event.preventDefault();
    const body = messageInput.trim();
    if (!body || !room?.id) return;
    setChatError("");
    try {
      const message = await sendRoomMessage(room.id, body);
      setMessages((current) => [...current, message].slice(-MAX_DISPLAYED_MESSAGES));
      lastMessageIdRef.current = message.id;
      setMessageInput("");
    } catch (error) {
      setChatError(error.message);
    }
  }

  async function handleInvite(userId) {
    setInviteError("");
    try {
      setRoom(await inviteRoomMembers(room.id, [userId]));
    } catch (error) {
      setInviteError(error.message);
    }
  }

  async function handleRemoveMember(userId) {
    setInviteError("");
    try {
      setRoom(await removeRoomMember(room.id, userId));
    } catch (error) {
      setInviteError(error.message);
    }
  }

  async function handleDeleteRoom() {
    if (!window.confirm("Delete this room? This removes it and its chat history for everyone.")) return;
    try {
      await deleteRoom(room.id);
      navigate("/rooms");
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function handleChangeSetting(setting) {
    if (setting === room.setting) return;
    setWallpaperError("");
    try {
      setRoom(await setRoomSetting(room.id, setting));
    } catch {
      setWallpaperError("Could not change the room background. Please try again.");
    }
  }

  async function handleUploadWallpaper(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;

    setUploadingWallpaper(true);
    setWallpaperError("");
    try {
      const url = await uploadRoomWallpaper(file, room.id);
      setRoom(await setRoomWallpaper(room.id, url));
      setWallpaperPanelOpen(false);
    } catch {
      setWallpaperError("Could not upload the image. Please try again.");
    } finally {
      setUploadingWallpaper(false);
    }
  }

  if (loadError || !room) {
    return (
      <div className="page study-room-page">
        <MenuIcon />
        <main className="study-room-shell">
          <p className="study-eyebrow">{loadError || "Loading room…"}</p>
        </main>
      </div>
    );
  }

  const members = room.members || [];
  const memberIds = new Set(members.map((member) => member.id));
  const invitableFriends = friends.filter(({ user }) => !memberIds.has(user.id));
  const removableMembers = members.filter((member) => member.id !== room.host_id);

  const settingLabel = room.setting
    ? room.setting.charAt(0).toUpperCase() + room.setting.slice(1)
    : "Campsite";

  const isHost = Boolean(room.host_id) && profile?.id === room.host_id;

  return (
    <div className="page study-room-page">
      <MenuIcon />
      <main className="study-room-shell">
        <header className="study-room-header">
          <div>
            <p className="study-eyebrow">{settingLabel}</p>
            <h1>{room.name} — {settingLabel}</h1>
          </div>
          <div className="study-room-controls">
            {room.chat_enabled && (
              <button
                className={`study-room-status ${chatOpen ? "is-on" : ""}`}
                onClick={() => setChatOpen((value) => !value)}
                aria-label={chatOpen ? "Close chat" : "Open chat"}
              >
                <MessageCircle size={18} /> Chat
              </button>
            )}
            {isHost && (
              <div className="study-invite-control">
                <button
                  className={`study-room-status ${invitePanelOpen ? "is-on" : ""}`}
                  onClick={() => setInvitePanelOpen((value) => !value)}
                  aria-label="Invite friends"
                >
                  <UserPlus size={18} /> Invite
                </button>
                {invitePanelOpen && (
                  <div className="study-invite-panel">
                    {removableMembers.length > 0 && (
                      <>
                        <p className="study-invite-panel-title">Members</p>
                        <div className="study-invite-list">
                          {removableMembers.map((member) => (
                            <div className="study-invite-option study-invite-member" key={member.id}>
                              <span className={`study-presence ${member.is_online ? "is-online" : ""}`} />
                              <span>{member.display_name || member.username}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id)}
                                aria-label={`Remove ${member.display_name || member.username}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="study-invite-panel-title">Invite friends</p>
                    {invitableFriends.length === 0 ? (
                      <p className="study-invite-empty">No friends to invite.</p>
                    ) : (
                      <div className="study-invite-list">
                        {invitableFriends.map(({ user }) => (
                          <button
                            key={user.id}
                            type="button"
                            className="study-invite-option"
                            onClick={() => handleInvite(user.id)}
                          >
                            <span className={`study-presence ${user.is_online ? "is-online" : ""}`} />
                            {user.display_name || user.username}
                          </button>
                        ))}
                      </div>
                    )}
                    {inviteError && <p className="study-form-error">{inviteError}</p>}
                  </div>
                )}
              </div>
            )}
            {isHost && (
              <div className="study-wallpaper-control">
                <button
                  className={`study-room-status ${wallpaperPanelOpen ? "is-on" : ""}`}
                  onClick={() => setWallpaperPanelOpen((value) => !value)}
                  aria-label="Customize room background"
                >
                  <ImageIcon size={18} /> Background
                </button>
                {wallpaperPanelOpen && (
                  <div className="study-wallpaper-panel">
                    <div className="study-wallpaper-settings">
                      {ROOM_SETTING_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className={`study-wallpaper-setting ${room.setting === key ? "is-active" : ""}`}
                          onClick={() => handleChangeSetting(key)}
                        >
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </button>
                      ))}
                    </div>
                    <label className="study-wallpaper-upload">
                      {uploadingWallpaper ? "Uploading…" : "Upload a custom background"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadWallpaper}
                        disabled={uploadingWallpaper}
                        hidden
                      />
                    </label>
                    {wallpaperError && <p className="study-form-error">{wallpaperError}</p>}
                  </div>
                )}
              </div>
            )}
            {isHost && (
              <button className="study-room-status study-room-delete-button" onClick={handleDeleteRoom} aria-label="Delete room">
                <Trash2 size={18} /> Delete
              </button>
            )}
            <button
              className={`study-music-toggle ${musicEnabled ? "is-on" : ""}`}
              onClick={() => setMusicEnabled((value) => !value)}
              aria-label={musicEnabled ? "Mute room music" : "Play room music"}
            >
              {musicEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <span>{musicEnabled ? "Music on" : "Music off"}</span>
            </button>
            {musicEnabled && (
              <input
                type="range"
                className="study-volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="Room music volume"
              />
            )}
          </div>
        </header>

        <audio ref={audioRef} src={roomSoundFor(room)} loop preload="auto" />

        <section className="study-room-scene" aria-label={`${settingLabel} study room`}>
          <img
            className="study-room-background"
            src={roomImageFor(room)}
            alt={`${settingLabel} study room background`}
          />

          <div className="study-member-layer">
            {members.slice(0, MEMBER_POSITIONS.length).map((member, index) => (
              <div
                className="study-member-marker"
                key={member.id || `${member.display_name}-${index}`}
                style={MEMBER_POSITIONS[index]}
              >
                <span className="study-member-name">{member.display_name || member.username || "Friend"}</span>
                <span className="study-member-avatar" aria-hidden="true">
                  {(member.display_name || member.username || "F").charAt(0)}
                </span>
              </div>
            ))}
          </div>

          <div className="study-timer-card">
            <div>
              <small>Focus timer</small>
              <strong>{formatTime(secondsRemaining)}</strong>
            </div>
            <button onClick={() => setRunning((value) => !value)} aria-label={running ? "Pause timer" : "Start timer"}>
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={() => {
                setSecondsRemaining((room.focus_minutes || 50) * 60);
                setRunning(false);
              }}
              aria-label="Reset timer"
            >
              <RotateCcw size={17} />
            </button>
          </div>

          <div className="study-room-music-note" aria-hidden="true">
            <Music size={18} /> {musicEnabled ? `ambient ${settingLabel.toLowerCase()}` : "quiet mode"}
          </div>

          {room.chat_enabled && chatOpen && (
            <div className="study-chat-panel">
              <div className="study-chat-header">
                <span>Chat</span>
                <button type="button" onClick={() => setChatOpen(false)} aria-label="Close chat">
                  <X size={16} />
                </button>
              </div>
              <div className="study-chat-messages">
                {messages.length === 0 && <p className="study-chat-empty">No messages yet — say hi!</p>}
                {messages.map((message, index) => {
                  const sentAt = new Date(message.created_at);
                  const previousSentAt = index > 0 ? new Date(messages[index - 1].created_at) : null;
                  const showDate = !previousSentAt || !isSameDay(sentAt, previousSentAt);
                  return (
                    <Fragment key={message.id}>
                      {showDate && <div className="study-chat-date">{formatMessageDate(sentAt)}</div>}
                      <div className="study-chat-message">
                        <strong>{message.user.display_name || message.user.username}</strong>
                        <span>{message.body}</span>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
              <form className="study-chat-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Message the room…"
                  maxLength={500}
                />
                <button type="submit" aria-label="Send message">
                  <Send size={16} />
                </button>
              </form>
              {chatError && <p className="study-form-error">{chatError}</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
