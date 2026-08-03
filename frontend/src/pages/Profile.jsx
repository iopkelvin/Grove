import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { uploadProfileImage } from "../lib/uploadImage";
import { getUserByUsername } from "../api/users";
import { sendFriendRequest, getFriends } from "../api/friends";
import { getTreeProgress } from "../api/streaks";
import useStreakLevelUp from "../hooks/useStreakLevelUp";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";
import StreakTree from "../components/StreakTree";
import { UserPlus, Mail, Bell, Pencil, CheckSquare, Users } from "lucide-react";

// Common presets, LinkedIn-style; "custom" reveals a free-text field capped
// at PRONOUNS_MAX_LENGTH so it can't turn into a full sentence.
const PRONOUN_PRESETS = ["she/her", "he/him", "they/them", "she/they", "he/they"];
const PRONOUNS_MAX_LENGTH = 20;

function Profile() {
  const { username } = useParams();
  const { session, loading, profile: myProfile, updateProfile } = useUser();

  const [viewedProfile, setViewedProfile] = useState(null);
  const [viewedProfileLoading, setViewedProfileLoading] = useState(Boolean(username));
  const [requestSent, setRequestSent] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pronounsPreset, setPronounsPreset] = useState("");
  const [pronounsCustom, setPronounsCustom] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(null);

  const isOwnProfile =
    !username || (myProfile && username.toLowerCase() === myProfile.username.toLowerCase());
  const profile = isOwnProfile ? myProfile : viewedProfile;
  const streak = profile?.current_streak ?? 0;

  const [stats, setStats] = useState({ points: 0, friends: 0 });

  const loadViewedProfile = useCallback(async () => {
    if (!username) return;
    setViewedProfileLoading(true);
    setViewedProfile(await getUserByUsername(username, session?.user?.id));
    setViewedProfileLoading(false);
  }, [username, session?.user?.id]);

  useEffect(() => {
    if (username) {
      loadViewedProfile();
    }
  }, [username, loadViewedProfile]);

  // Both /api/streaks/<id> and /api/friends only ever answer for the
  // signed-in caller, so these stats can only be shown for your own
  // profile — there's no way to fetch someone else's counts.
  useEffect(() => {
    if (!isOwnProfile || !session?.user?.id) return;
    Promise.allSettled([
      getTreeProgress(session.user.id),
      getFriends(session.user.id, { status: "accepted" }),
    ]).then(([pointsResult, friendsResult]) => {
      setStats({
        points: pointsResult.status === "fulfilled" ? pointsResult.value.points : 0,
        friends: friendsResult.status === "fulfilled" ? friendsResult.value.length : 0,
      });
    });
  }, [isOwnProfile, session?.user?.id]);

  const streakLeveledUp = useStreakLevelUp(isOwnProfile ? session?.user?.id : null, streak);

  if (loading || (username && viewedProfileLoading)) {
    return <div className="page">Loading...</div>;
  }

  if (username && !isOwnProfile && !viewedProfile) {
    return (
      <div className="page">
        <MenuIcon />
        <div className="page-content">
          <h1 className="page-title">User not found</h1>
        </div>
      </div>
    );
  }

  const email = isOwnProfile ? session?.user?.email || "" : null;
  const fullName = [capitalize(profile?.first_name), capitalize(profile?.last_name)]
    .filter(Boolean)
    .join(" ");

  async function handleImageChange(kind, e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    setUploadingImage(kind);
    setError("");
    try {
      const url = await uploadProfileImage(file, kind, session.user.id);
      const res = await updateProfile({ [`${kind}_url`]: url });
      if (!res.ok) {
        setError("Failed to save the new image. Please try again.");
      }
    } catch (err) {
      console.error(`Failed to upload ${kind}:`, err);
      setError(err.message ? `Failed to upload image: ${err.message}` : "Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(null);
    }
  }

  async function handleBannerPositionChange(position) {
    const res = await updateProfile({ banner_position_y: position });
    if (!res.ok) {
      setError("Failed to save the banner position. Please try again.");
    }
  }

  function startEditing() {
    setFirstName(myProfile?.first_name || "");
    setLastName(myProfile?.last_name || "");
    setDisplayName(myProfile?.display_name || "");
    const currentPronouns = myProfile?.pronouns || "";
    if (!currentPronouns) {
      setPronounsPreset("");
      setPronounsCustom("");
    } else if (PRONOUN_PRESETS.includes(currentPronouns)) {
      setPronounsPreset(currentPronouns);
      setPronounsCustom("");
    } else {
      setPronounsPreset("custom");
      setPronounsCustom(currentPronouns);
    }
    setBio(myProfile?.bio || "");
    setError("");
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    try {
      const pronouns = pronounsPreset === "custom" ? pronounsCustom.trim() : pronounsPreset;
      const res = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        pronouns,
        bio,
      });

      if (!res.ok) {
        setError("Failed to save changes. Please try again.");
        return;
      }

      setIsEditing(false);
    } catch {
      setError("Failed to save changes. Please try again.");
    }
  }

  async function handleAddFriend() {
    setError("");
    try {
      const res = await sendFriendRequest(session.user.id, viewedProfile.id);
      if (res.ok) {
        setRequestSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send friend request.");
      }
    } catch {
      setError("Failed to send friend request. Please try again.");
    }
  }

  const friendshipStatus = viewedProfile?.friendship_status;
  const addFriendDisabled = requestSent || Boolean(friendshipStatus);
  const addFriendLabel =
    requestSent || friendshipStatus === "pending"
      ? "Requested"
      : friendshipStatus === "accepted"
      ? "Friends"
      : "Add Friend";

  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <Banner
          bannerUrl={profile?.banner_url}
          positionY={profile?.banner_position_y ?? 50}
          onChange={isOwnProfile ? (e) => handleImageChange("banner", e) : undefined}
          onPositionChange={isOwnProfile ? handleBannerPositionChange : undefined}
        />
        {uploadingImage && <p className="profile-upload-status">Uploading {uploadingImage}...</p>}
        <div className="profile-content">
          <div className="profile-picture-wrap">
            <ProfilePicture
              avatarUrl={profile?.avatar_url}
              onChange={isOwnProfile ? (e) => handleImageChange("avatar", e) : undefined}
            />
          </div>
          <div className="profile-streak-card">
            <StreakTree streak={streak} userId={profile?.id} layout="overlay" glow={streakLeveledUp} />
          </div>
          <div className="profile-info-column">
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
                    <label>
                      First Name
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Last Name
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Display Name
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </label>
                    <label>
                      Pronouns
                      <select
                        value={pronounsPreset}
                        onChange={(e) => setPronounsPreset(e.target.value)}
                      >
                        <option value="">Not specified</option>
                        {PRONOUN_PRESETS.map((preset) => (
                          <option key={preset} value={preset}>
                            {preset}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                  </div>
                  {pronounsPreset === "custom" && (
                    <label>
                      Custom pronouns
                      <input
                        type="text"
                        value={pronounsCustom}
                        onChange={(e) => setPronounsCustom(e.target.value)}
                        maxLength={PRONOUNS_MAX_LENGTH}
                        placeholder="e.g. xe/xem"
                      />
                    </label>
                  )}
                  <label>
                    Bio
                    <textarea
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </label>
                  {error && <p className="auth-error">{error}</p>}
                  <div className="profile-edit-actions">
                    <button type="submit">Save</button>
                    <button type="button" onClick={() => setIsEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="profile-name-row">
                    <h2 className="profile-full-name">{fullName || "—"}</h2>
                    {profile?.pronouns && (
                      <span className="profile-pronouns">{profile.pronouns}</span>
                    )}
                  </div>
                  {isOwnProfile && (
                    <div className="profile-info-grid">
                      <div>
                        <h3>Email:</h3>
                        <p>{email}</p>
                      </div>
                    </div>
                  )}
                  <div className="profile-info-bio">
                    <h3>Bio:</h3>
                    {profile?.bio ? (
                      <p className="profile-bio-quote">{profile.bio}</p>
                    ) : (
                      <p>—</p>
                    )}
                  </div>
                  {error && <p className="auth-error">{error}</p>}
                </>
              )}
            </div>
            {isOwnProfile && (
              <div className="profile-stats">
                <div className="profile-stat-chip">
                  <CheckSquare size={16} />
                  <span>{stats.points} tasks completed</span>
                </div>
                <div className="profile-stat-chip">
                  <Users size={16} />
                  <span>{stats.friends} friends</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {!isOwnProfile && (
          <div className="profile-actions">
            <button className="profile-action" onClick={handleAddFriend} disabled={addFriendDisabled}>
              <UserPlus size={32} />
              <p>{addFriendLabel}</p>
            </button>
            <button className="profile-action">
              <Mail size={32} />
              <p>Send Message</p>
            </button>
            <button className="profile-action">
              <Bell size={32} />
              <p>Ping</p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
