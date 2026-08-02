import { useState, useEffect, useCallback } from "react";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { getFriends } from "../api/friends";
import { useTasks } from "../hooks/useTasks";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import MiniCalendar from "../components/MiniCalendar";
import UpNextCard from "../components/UpNextCard";
import TaskList from "../components/TaskList";
import UndoToast from "../components/UndoToast";
import HomeTutorial from "../components/HomeTutorial";
import useHomeTutorial from "../hooks/useHomeTutorial";
import useStreakLevelUp from "../hooks/useStreakLevelUp";

// Prefer the soonest-due incomplete task; if nothing has a due date, fall
// back to the oldest incomplete one (tasks arrive oldest-first already).
function pickNextTask(tasks) {
  const incomplete = tasks.filter((task) => !task.done);
  const dated = incomplete.filter((task) => task.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return dated[0] || incomplete[0];
}

function Home() {
  const { session, loading, profile } = useUser();
  const supabaseId = session?.user?.id;
  const { showTutorial, completeTutorial, closeTutorial } = useHomeTutorial(
    supabaseId,
    loading
  );
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const streak = profile?.current_streak ?? 0;
  const streakLeveledUp = useStreakLevelUp(supabaseId, streak);

  const [friends, setFriends] = useState([]);
  const { tasks, toggleTask, removeTask, pendingDelete, undoDelete } = useTasks(supabaseId);

  const loadFriends = useCallback(async () => {
    if (!supabaseId) return;
    setFriends(await getFriends(supabaseId, { status: "accepted" }));
  }, [supabaseId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = capitalize(profile?.first_name) || "there";
  const friendsOnline = friends.filter(({ user }) => user.is_online).length;
  const nextTask = pickNextTask(tasks);

  return (
    <div className="page">
      <MenuIcon />

      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <div data-home-tour="streak">
          <StreakTree streak={streak} userId={supabaseId} layout="overlay" glow={streakLeveledUp} />
        </div>

        <div className="grid-column">
          <div data-home-tour="friends">
            <FriendsCard friendsOnline={friendsOnline} />
          </div>

          <div data-home-tour="calendar">
            <MiniCalendar />
          </div>
        </div>

        <div className="grid-column">
          <div data-home-tour="up-next">
            <UpNextCard task={nextTask} />
          </div>
          <UndoToast task={pendingDelete} onUndo={undoDelete} />
          <div data-home-tour="tasks">
            <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} />
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
