import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { getRoom } from "../api/rooms";
import { useTasks } from "../hooks/useTasks";
import { getTreeSeason } from "../utils/treeGenerator";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import MiniCalendar from "../components/MiniCalendar";
import ContinueRoomCard from "../components/ContinueRoomCard";
import TaskList from "../components/TaskList";
import UndoToast from "../components/UndoToast";
import HomeTutorial from "../components/HomeTutorial";
import useHomeTutorial from "../hooks/useHomeTutorial";
import useStreakLevelUp from "../hooks/useStreakLevelUp";

// Top few incomplete tasks, soonest due first (no due date sorts last);
// same-day tasks are ordered by due time.
function pickUpNext(tasks, count = 3) {
  const incomplete = tasks.filter((task) => !task.done);
  return [...incomplete]
    .sort((a, b) => {
      const dateA = a.due_date || "9999-99-99";
      const dateB = b.due_date || "9999-99-99";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.due_time || "99:99";
      const timeB = b.due_time || "99:99";
      return timeA.localeCompare(timeB);
    })
    .slice(0, count);
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
  const season = getTreeSeason(streak);

  const [lastRoom, setLastRoom] = useState(null);
  const { tasks, toggleTask, removeTask, pendingDelete, undoDelete } = useTasks(supabaseId);

  useEffect(() => {
    if (!profile?.last_room_id) {
      setLastRoom(null);
      return;
    }
    getRoom(profile.last_room_id)
      .then(setLastRoom)
      .catch(() => setLastRoom(null));
  }, [profile?.last_room_id]);

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = capitalize(profile?.first_name) || "there";
  const activeTasks = tasks.filter((task) => !task.done);
  const upNext = pickUpNext(tasks);

  return (
    <div className="page">
      <MenuIcon />

      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <div data-home-tour="streak">
          <StreakTree streak={streak} userId={supabaseId} layout="overlay" glow={streakLeveledUp} />
        </div>

        <div className="grid-column">
          <div data-home-tour="calendar">
            <MiniCalendar tasks={tasks} season={season} />
          </div>

          <ContinueRoomCard room={lastRoom} />
        </div>

        <div className="grid-column">
          <div data-home-tour="up-next">
            <p className="up-next-title">Up Next</p>
            <TaskList
              tasks={upNext}
              onToggle={toggleTask}
              onDelete={removeTask}
              emptyMessage="All caught up!"
            />
          </div>
          <UndoToast task={pendingDelete} onUndo={undoDelete} />
          <div data-home-tour="tasks">
            <TaskList tasks={activeTasks} onToggle={toggleTask} onDelete={removeTask} />
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
