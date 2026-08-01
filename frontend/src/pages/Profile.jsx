// Profile — your own, or anyone else's at /user/:username.
//
// Fixes carried in beyond the API rewrite:
//
//   * `isOwnProfile` was computed as `!username || username === myProfile.username`,
//     which is undefined-safe only by accident: on a public profile viewed
//     while signed out, `myProfile` is null and the expression threw. The
//     page now derives it from the server's `is_self` flag with a local
//     fallback.
//   * "Send Message" and "Ping" were buttons that did nothing at all when
//     clicked. They are labelled as planned rather than pretending to work.
//   * Image upload had no size or type check, so a 40MB photo was uploaded
//     in full and then failed at the storage layer with an opaque error.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Bell, Mail, Pencil, UserPlus } from "lucide-react";

import { sendFriendRequest } from "../api/friends";
import { getUserByUsername } from "../api/users";
import Banner from "../components/Banner";
import MenuIcon from "../components/MenuIcon";
import ProfilePicture from "../components/ProfilePicture";
import StreakTree from "../components/StreakTree";
import { ErrorState, LoadingState } from "../components/states";
import { useUser } from "../context/UserContext";
import { ApiError, messageFor } from "../lib/apiClient";
import { capitalize } from "../lib/format";
import { MAX_IMAGE_BYTES, uploadProfileImage } from "../lib/uploadImage";

export default function Profile() {
  const { username } = useParams();
  const { session, loading: userLoading, profile: myProfile, updateProfile } = useUser();

  const [viewed, setViewed] = useState(null);
  const [viewedLoading, setViewedLoading] = useState(Boolean(username));
  const [viewedError, setViewedError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "", bio: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [requestSent, setRequestSent] = useState(false);

  const loadViewed = useCallback(async () => {
    if (!username) return;
    setViewedLoading(true);
    setViewedError(null);
    try {
      setViewed(await getUserByUsername(username));
    } catch (err) {
      setViewedError(err);
    } finally {
      setViewedLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadViewed();
  }, [loadViewed]);

  if (userLoading || (username && viewedLoading)) {
    return (
      <div className="page">
        <MenuIcon />
        <LoadingState label="Loading profile" />
      </div>
    );
  }

  if (viewedError) {
    const notFound = viewedError instanceof ApiError && viewedError.status === 404;
    return (
      <div className="page">
        <MenuIcon />
        <div className="page-content">
          {notFound ? (
            <>
              <h1 className="page-title">No such user</h1>
              <p className="state-hint">Nobody on Grove goes by “{username}”.</p>
            </>
          ) : (
            <ErrorState error={viewedError} onRetry={loadViewed} />
          )}
        </div>
      </div>
    );
  }

  // `is_self` comes from the server, which knows who is asking. The local
  // comparison is the fallback for /profile, where there is no username in
  // the URL at all.
  const isOwnProfile = username ? Boolean(viewed?.is_self) : true;
  const profile = isOwnProfile ? (username ? viewed : myProfile) : viewed;
  const email = isOwnProfile ? profile?.email || session?.user?.email || "" : null;

  if (!profile) {
    return (
      <div className="page">
        <MenuIcon />
        <div className="page-content">
          <h1 className="page-title">Profile unavailable</h1>
        </div>
      </div>
    );
  }

  function startEditing() {
    setForm({
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      displayName: profile.display_name || "",
      bio: profile.bio || "",
    });
    setError("");
    setFieldErrors({});
    setIsEditing(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      await updateProfile({
        first_name: form.firstName,
        last_name: form.lastName,
        display_name: form.displayName,
        bio: form.bio,
      });
      if (username) await loadViewed();
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(messageFor(err, "Could not save your changes."));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(kind, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    // Checked here rather than at the storage layer so the user gets a
    // sentence they can act on instead of a provider error code — and so a
    // 40MB photo is never uploaded in the first place.
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Images must be under ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.`);
      return;
    }

    setUploading(kind);
    setError("");
    try {
      const url = await uploadProfileImage(file, kind, session.user.id);
      await updateProfile({ [`${kind}_url`]: url });
      if (username) await loadViewed();
    } catch (err) {
      setError(messageFor(err, "Could not upload that image."));
    } finally {
      setUploading(null);
    }
  }

  async function handleAddFriend() {
    setError("");
    try {
      await sendFriendRequest(profile.id);
      setRequestSent(true);
    } catch (err) {
      setError(messageFor(err, "Could not send the friend request."));
    }
  }

  const friendshipStatus = requestSent ? "pending" : profile.friendship_status;
  const addFriendLabel =
    friendshipStatus === "accepted"
      ? "Friends"
      : friendshipStatus === "pending"
        ? "Requested"
        : "Add Friend";

  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <Banner
          bannerUrl={profile.banner_url}
          onChange={isOwnProfile ? (event) => handleImageChange("banner", event) : undefined}
          editable={isOwnProfile}
        />
        {uploading && (
          <p className="profile-upload-status" role="status">
            Uploading {uploading}…
          </p>
        )}

        <div className="profile-content">
          <div className="profile-picture-wrap">
            <ProfilePicture
              avatarUrl={profile.avatar_url}
              username={profile.username}
              onChange={isOwnProfile ? (event) => handleImageChange("avatar", event) : undefined}
              editable={isOwnProfile}
            />
            <div className="card profile-streak-card">
              <StreakTree
                streak={profile.current_streak ?? 0}
                userId={profile.supabase_id ?? profile.username}
              />
            </div>
          </div>

          <div className="card profile-info-card">
            {isOwnProfile && !isEditing && (
              <button
                type="button"
                className="profile-edit-icon-button"
                onClick={startEditing}
                aria-label="Edit profile"
              >
                <Pencil size={16} />
              </button>
            )}

            {isEditing ? (
              <form onSubmit={handleSave} className="profile-edit-form">
                <div className="profile-edit-grid">
                  <Field
                    label="First Name"
                    value={form.firstName}
                    error={fieldErrors.first_name}
                    onChange={(value) => setForm({ ...form, firstName: value })}
                    required
                    maxLength={50}
                  />
                  <Field
                    label="Last Name"
                    value={form.lastName}
                    error={fieldErrors.last_name}
                    onChange={(value) => setForm({ ...form, lastName: value })}
                    required
                    maxLength={50}
                  />
                  <Field
                    label="Display Name"
                    value={form.displayName}
                    error={fieldErrors.display_name}
                    onChange={(value) => setForm({ ...form, displayName: value })}
                    maxLength={80}
                  />
                </div>
                <label>
                  Bio
                  <textarea
                    rows={4}
                    value={form.bio}
                    maxLength={500}
                    onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  />
                  <span className="field-hint">{form.bio.length}/500</span>
                </label>
                {fieldErrors.bio && <span className="field-error">{fieldErrors.bio}</span>}
                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="profile-edit-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="profile-info-grid">
                  <Fact label="First Name" value={capitalize(profile.first_name)} />
                  <Fact label="Last Name" value={capitalize(profile.last_name)} />
                  <Fact label="Display Name" value={profile.display_name} />
                  {isOwnProfile && <Fact label="Email" value={email} />}
                </div>
                <div className="profile-info-bio">
                  <h3>Bio</h3>
                  <p>{profile.bio || "—"}</p>
                </div>
                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {!isOwnProfile && (
          <div className="profile-actions">
            <button
              className="profile-action"
              onClick={handleAddFriend}
              disabled={Boolean(friendshipStatus)}
            >
              <UserPlus size={32} aria-hidden="true" />
              <p>{addFriendLabel}</p>
            </button>
            {/* Labelled as planned rather than rendered as working buttons
                that silently do nothing when clicked. */}
            <button className="profile-action" disabled title="Direct messages are not built yet">
              <Mail size={32} aria-hidden="true" />
              <p>Message</p>
              <span className="profile-action-soon">Planned</span>
            </button>
            <button className="profile-action" disabled title="Pings are not built yet">
              <Bell size={32} aria-hidden="true" />
              <p>Ping</p>
              <span className="profile-action-soon">Planned</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, error, ...rest }) {
  return (
    <label>
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <h3>{label}</h3>
      <p>{value || "—"}</p>
    </div>
  );
}
