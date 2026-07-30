import { useUser } from "../context/UserContext";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";
import { UserPlus, Mail, Bell } from "lucide-react";

function Profile() {
  const { user, loading } = useUser();

  if (loading) {
    return <div className="page">Loading...</div>;
  }

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
              <p>{user.name}</p>
            </div>
            <div>
              <h3>Bio:</h3>
              <p>{user.bio}</p>
            </div>
            <div>
              <h3>Streak:</h3>
              <p>Successfully completed {user.streak} day tasks.</p>
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