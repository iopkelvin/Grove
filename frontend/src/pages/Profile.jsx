import { useUser } from "../context/UserContext";
import MenuIcon from "../components/MenuIcon";
import Banner from "../components/Banner";
import ProfilePicture from "../components/ProfilePicture";

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
            <span>+</span>
            <p>Add Friend</p>
          </button>
          <button className="profile-action">
            <span>✉</span>
            <p>Send Message</p>
          </button>
          <button className="profile-action">
            <span>👆</span>
            <p>Ping</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;