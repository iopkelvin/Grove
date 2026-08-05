import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { getTreeCycleLevel } from "../lib/treeCycle";
import { uploadProfileImage } from "../lib/uploadImage";
import { getUserByUsername } from "../api/users";
import { sendFriendRequestOrError, getFriendshipState, getFriends } from "../api/friends";
import { getTreeProgress } from "../api/streaks";
import useStreakLevelUp from "../hooks/useStreakLevelUp";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";
import StreakTree from "../components/StreakTree";
import { UserPlus, Pencil, Users, Trophy, ClipboardCheck, Leaf, CalendarDays } from "lucide-react";

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
  const treeLevel = getTreeCycleLevel(profile?.current_streak);
  const [stats, setStats] = useState({ points: 0, trophy_points: 0, friends: 0 });

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

  useEffect(() => {
    if (!isOwnProfile) {
      setStats({
        points: viewedProfile?.completed_tasks ?? 0,
        trophy_points: viewedProfile?.trophy_points ?? 0,
        friends: viewedProfile?.friend_count ?? 0,
      });
      return;
    }
    if (!session?.user?.id) return;
    Promise.allSettled([
      getTreeProgress(session.user.id),
      getFriends(session.user.id, { status: "accepted" }),
    ]).then(([pointsResult, friendsResult]) => {
      const progress = pointsResult.status === "fulfilled" ? pointsResult.value : {};
      setStats({
        points: progress.points ?? 0,
        trophy_points: progress.trophy_points ?? 0,
        friends: friendsResult.status === "fulfilled" ? friendsResult.value.length : 0,
      });
    });
  }, [isOwnProfile, session?.user?.id, viewedProfile]);

  const streakLeveledUp = useStreakLevelUp(
    isOwnProfile ? session?.user?.id : null,
    profile?.current_streak ?? 0
  );

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
  const memberSince = profile?.created_at
    ? new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(profile.created_at))
    : null;

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
    const result = await sendFriendRequestOrError(session.user.id, viewedProfile.id);
    if (result.ok) {
      setRequestSent(true);
    } else {
      setError(result.error);
    }
  }

  const friendState = getFriendshipState(viewedProfile?.friendship_status, requestSent);
  const addFriendDisabled = friendState !== "none";
  const addFriendLabel =
    friendState === "requested" ? "Requested" : friendState === "friends" ? "Friends" : "Add Friend";

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
            <StreakTree streak={treeLevel} userId={profile?.id} glow={streakLeveledUp} />
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
            <div className="profile-social-stat">
              <div className="profile-stat-chip">
                <Users size={16} />
                <span>{stats.friends} friends</span>
              </div>
              {memberSince && (
                <div className="profile-stat-chip">
                  <CalendarDays size={16} />
                  <span>Joined {memberSince}</span>
                </div>
              )}
            </div>
            <section className="card profile-achievements" aria-labelledby="achievements-title">
              <div className="profile-achievements-heading">
                <h2 id="achievements-title">Achievements</h2>
              </div>
              <div className="profile-achievement-summary">
                <div className="profile-completed-stat">
                  <div className="profile-task-emblem" aria-hidden="true">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <strong>{stats.points}</strong>
                    <span>tasks completed</span>
                  </div>
                </div>
                <div className="profile-trophy-stat">
                  <div className="profile-trophy-emblem" aria-hidden="true">
                    <Leaf className="profile-trophy-leaf profile-trophy-leaf-left" size={15} />
                    <Trophy size={28} />
                    <Leaf className="profile-trophy-leaf profile-trophy-leaf-right" size={15} />
                  </div>
                  <div>
                    <strong>{stats.trophy_points}</strong>
                    <span>{stats.trophy_points === 1 ? "trophy earned" : "trophies earned"}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        {!isOwnProfile && (
          <div className="profile-actions">
            <button className="profile-action" onClick={handleAddFriend} disabled={addFriendDisabled}>
              <UserPlus size={32} />
              <p>{addFriendLabel}</p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
