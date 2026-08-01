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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const [friends, setFriends] = useState([]);
  const { tasks, toggleTask, editTask, removeTask, pendingDelete, undoDelete } = useTasks(supabaseId);

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
  const streak = profile?.current_streak ?? 0;
  const friendsOnline = friends.filter(({ user }) => user.is_online).length;
  const nextTask = pickNextTask(tasks);

  return (
    <div className="page">
      <MenuIcon />
      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <StreakTree streak={streak} userId={session?.user?.id} layout="overlay" />

        <div className="grid-column">
          <FriendsCard friendsOnline={friendsOnline} />
          <MiniCalendar />
        </div>

        <div className="grid-column">
          <UpNextCard task={nextTask} />
          <UndoToast task={pendingDelete} onUndo={undoDelete} />
          <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} onEdit={editTask} />
        </div>
      </div>
    </div>
  );
}

export default Home;
