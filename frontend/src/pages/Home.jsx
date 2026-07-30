// Kelvin 
// pages/Home.jsx
import { useUser } from "../context/UserContext";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import CalendarWidget from "../components/CalendarWidget";
import UpNextCard from "../components/UpNextCard";
import TaskList from "../components/TaskList";

function Home() {
  const { user, loading } = useUser();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">{greeting}, {user.name}</h1>

      <div className="grid">
        <StreakTree streak={user.streak} />

        <div className="grid-column">
          <FriendsCard friendsOnline={user.friendsOnline} />
          <CalendarWidget />
        </div>

        <div className="grid-column">
          <UpNextCard />
          <TaskList />
        </div>
      </div>
    </div>
  );
}

export default Home;