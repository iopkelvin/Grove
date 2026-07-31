import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import CalendarWidget from "../components/CalendarWidget";
import UpNextCard from "../components/UpNextCard";
import TaskList from "../components/TaskList";

function Home() {
  const { session, loading, profile } = useUser();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = capitalize(profile?.first_name) || "there";
  const streak = profile?.current_streak ?? 0;

  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <StreakTree streak={streak} userId={session?.user?.id} />

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