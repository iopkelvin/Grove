import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import CalendarWidget from "../components/CalendarWidget";
import UpNextCard from "../components/UpNextCard";
import TaskList from "../components/TaskList";
import HomeTutorial from "../components/HomeTutorial";
import useHomeTutorial from "../hooks/useHomeTutorial";

function Home() {
  const { session, loading, profile } = useUser();
  const { showTutorial, completeTutorial, closeTutorial } = useHomeTutorial(
    session?.user?.id,
    loading
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = capitalize(profile?.first_name) || "there";

  return (
    <div className="page">
      <MenuIcon />

      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <div data-home-tour="streak">
          <StreakTree streak={0} />
        </div>

        <div className="grid-column">
          <div data-home-tour="friends">
            <FriendsCard friendsOnline={0} />
          </div>

          <div data-home-tour="calendar">
            <CalendarWidget />
          </div>
        </div>

        <div className="grid-column">
          <div data-home-tour="up-next">
            <UpNextCard />
          </div>

          <div data-home-tour="tasks">
            <TaskList />
          </div>
        </div>
      </div>

      {showTutorial && (
        <HomeTutorial
          onComplete={completeTutorial}
          onClose={closeTutorial}
        />
      )}
    </div>
  );
}

export default Home;