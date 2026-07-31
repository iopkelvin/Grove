import { useState } from "react";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { uploadProfileImage } from "../lib/uploadImage";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";
import StreakTree from "../components/StreakTree";
import { UserPlus, Mail, Bell, Pencil } from "lucide-react";

function Profile() {
  const { session, loading, profile, updateProfile } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(null);

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const email = session?.user?.email || "";
  const streak = profile?.current_streak ?? 0;

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
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(null);
    }
  }

  function startEditing() {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setDisplayName(profile?.display_name || "");
    setBio(profile?.bio || "");
    setError("");
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    const res = await updateProfile({
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      bio,
    });

    if (!res.ok) {
      setError("Failed to save changes. Please try again.");
      return;
    }

    setIsEditing(false);
  }

  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <Banner
          bannerUrl={profile?.banner_url}
          onChange={(e) => handleImageChange("banner", e)}
        />
        {uploadingImage && <p className="profile-upload-status">Uploading {uploadingImage}...</p>}
        <div className="profile-content">
          <div className="profile-picture-wrap">
            <ProfilePicture
              avatarUrl={profile?.avatar_url}
              onChange={(e) => handleImageChange("avatar", e)}
            />
            <div className="card profile-streak-card">
              <StreakTree streak={streak} />
            </div>
          </div>
          <div className="card profile-info-card">
            {!isEditing && (
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
                </div>
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
                <div className="profile-info-grid">
                  <div>
                    <h3>First Name:</h3>
                    <p>{capitalize(profile?.first_name) || "—"}</p>
                  </div>
                  <div>
                    <h3>Last Name:</h3>
                    <p>{capitalize(profile?.last_name) || "—"}</p>
                  </div>
                  <div>
                    <h3>Display Name:</h3>
                    <p>{profile?.display_name || "—"}</p>
                  </div>
                  <div>
                    <h3>Email:</h3>
                    <p>{email}</p>
                  </div>
                </div>
                <div className="profile-info-bio">
                  <h3>Bio:</h3>
                  <p>{profile?.bio || "—"}</p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="profile-actions">
          <button className="profile-action">
            <UserPlus size={32} />
            <p>Add Friend</p>
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
      </div>
    </div>
  );
}

export default Profile;
