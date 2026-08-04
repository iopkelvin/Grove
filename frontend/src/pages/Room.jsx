import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  Image as ImageIcon,
  MessageCircle,
  Music,
  Pause,
  Play,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { useUser } from "../context/UserContext";
import { uploadRoomWallpaper } from "../lib/uploadImage";
import {
  getRoom,
  visitRoom,
  roomImageFor,
  roomSoundFor,
  setRoomWallpaper,
  setRoomSetting,
  ROOM_SETTING_KEYS,
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

const CHAT_POLL_INTERVAL_MS = 4000;
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


export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const { profile } = useUser();
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

  // Chat: load recent history once the panel is opened, then poll for
  // anything newer than the last message we've seen. Simple polling, not
  // a websocket — matches every other shared-state feature in this app.
  useEffect(() => {
    if (!room || !room.chat_enabled || !chatOpen || !isRealRoomId(room.id)) return undefined;

    let cancelled = false;

    async function loadInitial() {
      try {
        const initial = await getRoomMessages(room.id);
        if (cancelled) return;
        setMessages(initial);
        if (initial.length) lastMessageIdRef.current = initial[initial.length - 1].id;
      } catch (error) {
        console.error("Failed to load room messages:", error);
      }
    }

    async function poll() {
      try {
        const fresh = await getRoomMessages(room.id, lastMessageIdRef.current);
        if (cancelled || fresh.length === 0) return;
        setMessages((current) => [...current, ...fresh].slice(-MAX_DISPLAYED_MESSAGES));
        lastMessageIdRef.current = fresh[fresh.length - 1].id;
      } catch (error) {
        console.error("Failed to poll room messages:", error);
      }
    }

    loadInitial();
    const interval = window.setInterval(poll, CHAT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [room?.id, room?.chat_enabled, chatOpen]);

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

  const settingLabel = room.setting
    ? room.setting.charAt(0).toUpperCase() + room.setting.slice(1)
    : "Campsite";

  const canEditWallpaper = Boolean(room.host_id) && profile?.id === room.host_id;

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
            {canEditWallpaper && (
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
              <div className="study-chat-messages">
                {messages.length === 0 && <p className="study-chat-empty">No messages yet — say hi!</p>}
                {messages.map((message) => (
                  <div className="study-chat-message" key={message.id}>
                    <strong>{message.user.display_name || message.user.username}</strong>
                    <span>{message.body}</span>
                  </div>
                ))}
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
