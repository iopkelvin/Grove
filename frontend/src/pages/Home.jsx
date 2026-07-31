import { useUser } from "../context/UserContext";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import CalendarWidget from "../components/CalendarWidget";
import UpNextCard from "../components/UpNextCard";
import TaskList from "../components/TaskList";

function Home() {
  const { session, loading } = useUser();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const rawFirstName = session?.user?.user_metadata?.first_name;
  const firstName = rawFirstName
    ? rawFirstName[0].toUpperCase() + rawFirstName.slice(1)
    : "there";

  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <StreakTree streak={0} />

        <div className="grid-column">
          <FriendsCard friendsOnline={0} />
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