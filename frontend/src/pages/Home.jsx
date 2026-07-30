// Kelvin 
// pages/Home.jsx
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import CalendarWidget from "../components/CalendarWidget";
import UpNextCard from "../components/UpNextCard";
import TaskList from "../components/TaskList";

function Home() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="page">
      <h1 className="page-title">{greeting}, Kelvin</h1>

      <div className="grid">
        <StreakTree />

        <div className="grid-column">
          <FriendsCard />
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