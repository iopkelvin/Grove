import { useMemo, useState } from "react";
import { ChevronDown, Music, MessageCircle, X } from "lucide-react";
import { ROOM_SETTING_KEYS, ROOM_SETTING_LABELS } from "../api/rooms";
import { displayNameOf } from "../lib/format";

const FOCUS_MINUTE_PRESETS = [25, 50, 90];
const MIN_FOCUS_MINUTES = 5;
const MAX_FOCUS_MINUTES = 180;

function ToggleField({ icon: Icon, label, checked, onChange }) {
  return (
    <label className="study-toggle-row">
      <span><Icon size={18} /> {label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, children }) {
  return (
    <label>
      {label}
      <div className="study-select-wrap">
        <select value={value} onChange={onChange}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="study-select-icon" size={16} aria-hidden="true" />
      </div>
      {children}
    </label>
  );
}

export default function CreateRoomModal({ friends, onClose, onCreate, creating, error }) {
  const [name, setName] = useState("My Study Room");
  const [setting, setSetting] = useState("campsite");
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [focusMinutes, setFocusMinutes] = useState(50);
  const isCustomFocus = !FOCUS_MINUTE_PRESETS.includes(focusMinutes);

  const filteredFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    return friends
      .filter((friend) => !query || displayNameOf(friend).toLowerCase().includes(query))
      .sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b)));
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
            <SelectField
              label="Map"
              value={setting}
              onChange={(event) => setSetting(event.target.value)}
              options={ROOM_SETTING_KEYS.map((key) => ({ value: key, label: ROOM_SETTING_LABELS[key] }))}
            />
            <SelectField
              label="Focus timer"
              value={isCustomFocus ? "custom" : focusMinutes}
              onChange={(event) => {
                const value = event.target.value;
                setFocusMinutes(value === "custom" ? 60 : Number(value));
              }}
              options={[
                ...FOCUS_MINUTE_PRESETS.map((minutes) => ({ value: minutes, label: `${minutes} minutes` })),
                { value: "custom", label: "Custom" },
              ]}
            >
              {isCustomFocus && (
                <input
                  type="number"
                  min={MIN_FOCUS_MINUTES}
                  max={MAX_FOCUS_MINUTES}
                  value={focusMinutes}
                  onChange={(event) => setFocusMinutes(Number(event.target.value))}
                  aria-label="Custom focus timer minutes"
                />
              )}
            </SelectField>
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
                  <span>{displayNameOf(friend)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="study-toggle-grid">
            <ToggleField
              icon={Music}
              label="Music"
              checked={musicEnabled}
              onChange={(event) => setMusicEnabled(event.target.checked)}
            />
            <ToggleField
              icon={MessageCircle}
              label="Chat"
              checked={chatEnabled}
              onChange={(event) => setChatEnabled(event.target.checked)}
            />
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
