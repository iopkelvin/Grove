// Settings.
//
// This file was zero bytes and the menu linked to a route that did not
// exist. The plan lists "UI options, accessibility options, online status
// visibility" — all three are here, and all three are backed by something
// real rather than being decorative switches.

import { useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import PageLayout from "../components/PageLayout";
import { THEME_OPTIONS, useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { messageFor } from "../lib/apiClient";

const THEME_LABELS = {
  system: { label: "Match my system", icon: Monitor },
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
};

export default function Settings() {
  const { preference, setTheme } = useTheme();
  const { profile, updateProfile, logout } = useUser();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function setPresenceVisibility(visible) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateProfile({ show_online_status: visible });
      setSaved(true);
      // The confirmation disappears on its own; a tick that stays forever
      // stops reading as "that just saved".
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(messageFor(err, "Could not save that setting."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout title="Settings">
      <section className="card settings-section">
        <h2 className="card-title">Appearance</h2>
        <p className="settings-hint">
          Dark mode is applied instantly and remembered on this device.
        </p>
        <div className="settings-choices" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => {
            const { label, icon: Icon } = THEME_LABELS[option];
            const selected = preference === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`settings-choice ${selected ? "settings-choice-active" : ""}`}
                onClick={() => setTheme(option)}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card settings-section">
        <h2 className="card-title">Privacy</h2>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={profile?.show_online_status !== false}
            disabled={saving || !profile}
            onChange={(event) => setPresenceVisibility(event.target.checked)}
          />
          <span>
            Show when I am online
            <span className="settings-hint">
              When this is off, friends and study rooms show you as offline. You can still
              join rooms and see everybody else.
            </span>
          </span>
        </label>

        {saved && (
          <p className="settings-saved" role="status">
            <Check size={16} aria-hidden="true" /> Saved
          </p>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="card settings-section">
        <h2 className="card-title">Account</h2>
        <dl className="settings-facts">
          <div>
            <dt>Username</dt>
            <dd>{profile?.username ?? "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile?.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </dd>
          </div>
        </dl>
        <button type="button" className="settings-logout" onClick={logout}>
          Log out
        </button>
      </section>
    </PageLayout>
  );
}
