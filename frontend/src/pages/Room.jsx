import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { MessageCircle, Music, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { getRoom, visitRoom } from "../api/rooms";

// Shown in place of real members until a room has database-backed ones.
const PLACEHOLDER_MEMBERS = [
  { id: "jose", display_name: "Jose" },
  { id: "jack", display_name: "Jack" },
  { id: "jeff", display_name: "Jeff" },
  { id: "john", display_name: "John" },
];

// Percentage-based so marker placement holds up across screen resolutions.
const MEMBER_POSITIONS = [
  { left: "29%", top: "50%" },
  { left: "48%", top: "38%" },
  { left: "67%", top: "47%" },
  { left: "60%", top: "68%" },
  { left: "39%", top: "67%" },
  { left: "76%", top: "61%" },
];

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}


export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const [room, setRoom] = useState(location.state?.room || null);
  const [running, setRunning] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(location.state?.room?.music_enabled ?? true);

  const initialMinutes = room?.focus_minutes || 50;
  const [secondsRemaining, setSecondsRemaining] = useState(initialMinutes * 60);

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

    if (/^\d+$/.test(roomId)) {
      getRoom(roomId).then(setRoom).catch(() => setRoom(null));
    }
  }, [room, roomId]);

  // Recorded for the Home page's "continue where you left off" widget.
  // Independent of the room-resolution effect above so it still fires when
  // the room came from the sessionStorage/location.state cache.
  useEffect(() => {
    if (/^\d+$/.test(roomId)) {
      visitRoom(roomId).catch(() => {});
    }
  }, [roomId]);

  useEffect(() => {
    if (!room) return;
    setMusicEnabled(room.music_enabled ?? true);
    setSecondsRemaining((room.focus_minutes || 50) * 60);
  }, [room?.id]);

  useEffect(() => {
    if (!running || secondsRemaining <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsRemaining]);

  const resolvedRoom = room || {
    id: roomId,
    name: roomId?.includes("mars") ? "CS 160 Mars Lab" : "61C Cozy Study Room",
    setting: roomId?.includes("mars") ? "mars" : "campsite",
    music_enabled: true,
    chat_enabled: true,
    focus_minutes: 50,
    members: PLACEHOLDER_MEMBERS,
  };

  const members = useMemo(
    () => (resolvedRoom.members?.length ? resolvedRoom.members : PLACEHOLDER_MEMBERS),
    [resolvedRoom.members]
  );

  const settingLabel = resolvedRoom.setting
    ? resolvedRoom.setting.charAt(0).toUpperCase() + resolvedRoom.setting.slice(1)
    : "Campsite";

  return (
    <div className="page study-room-page">
      <MenuIcon />
      <main className="study-room-shell">
        <header className="study-room-header">
          <div>
            <p className="study-eyebrow">{settingLabel}</p>
            <h1>{resolvedRoom.name} — {settingLabel}</h1>
          </div>
          <div className="study-room-controls">
            {resolvedRoom.chat_enabled && (
              <span className="study-room-status" title="Chat enabled">
                <MessageCircle size={18} /> Chat on
              </span>
            )}
            <button
              className={`study-music-toggle ${musicEnabled ? "is-on" : ""}`}
              onClick={() => setMusicEnabled((value) => !value)}
              aria-label={musicEnabled ? "Mute room music" : "Play room music"}
            >
              {musicEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <span>{musicEnabled ? "Music on" : "Music off"}</span>
            </button>
          </div>
        </header>

        <section className="study-room-scene" aria-label={`${settingLabel} study room`}>
          <img className="study-room-background" src="/assets/Study-Room.png" alt="Pixel art campsite study room" />

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
                setSecondsRemaining((resolvedRoom.focus_minutes || 50) * 60);
                setRunning(false);
              }}
              aria-label="Reset timer"
            >
              <RotateCcw size={17} />
            </button>
          </div>

          <div className="study-room-music-note" aria-hidden="true">
            <Music size={18} /> {musicEnabled ? "ambient campfire" : "quiet mode"}
          </div>
        </section>
      </main>
    </div>
  );
}
