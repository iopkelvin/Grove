import { useState } from "react";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";
import { UserPlus, Mail, Bell, Pencil } from "lucide-react";

function Profile() {
  const { session, loading, profile, updateProfile } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const email = session?.user?.email || "";
  const streak = profile?.current_streak ?? 0;

  function startEditing() {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setDisplayName(profile?.display_name || "");
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
        <Banner />
        <div className="profile-content">
          <ProfilePicture avatarUrl={profile?.avatar_url} />
          <div className="card profile-info-card">
            {isEditing ? (
              <form onSubmit={handleSave} className="profile-edit-form">
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
                <div>
                  <h3>Streak:</h3>
                  <p>Current streak: {streak} day{streak === 1 ? "" : "s"}.</p>
                </div>
                <button type="button" className="profile-edit-toggle" onClick={startEditing}>
                  <Pencil size={16} />
                  Edit Profile
                </button>
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
