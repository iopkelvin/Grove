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
    <div className="home-page">
      <h1>{greeting}, Kelvin</h1>

      <div className="home-grid">
        <StreakTree />

        <div className="home-middle">
          <FriendsCard />
          <CalendarWidget />
        </div>

        <div className="home-right">
          <UpNextCard />
          <TaskList />
        </div>
      </div>
    </div>
  );
}

export default Home;