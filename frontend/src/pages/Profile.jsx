import { useUser } from "../context/UserContext";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";
import { UserPlus, Mail, Bell } from "lucide-react";

function Profile() {
  const { session, loading } = useUser();

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const displayName = session?.user?.email?.split("@")[0] || "Unknown";
  const email = session?.user?.email || "";

  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <Banner />
        <div className="profile-content">
          <ProfilePicture />
          <div className="card profile-info-card">
            <div>
              <h3>Name:</h3>
              <p>{displayName}</p>
            </div>
            <div>
              <h3>Email:</h3>
              <p>{email}</p>
            </div>
            <div>
              <h3>Streak:</h3>
              <p>Successfully completed 0 day tasks.</p>
            </div>
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