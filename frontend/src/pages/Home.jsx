import { useState, useEffect, useCallback } from "react";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { getFriends } from "../api/friends";
import { getTasks, updateTask, deleteTask } from "../api/tasks";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import FriendsCard from "../components/FriendsCard";
import MiniCalendar from "../components/MiniCalendar";
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

  const [friends, setFriends] = useState([]);
  const [tasks, setTasks] = useState([]);

  const loadFriends = useCallback(async () => {
    if (!supabaseId) return;
    setFriends(await getFriends(supabaseId, { status: "accepted" }));
  }, [supabaseId]);

  const loadTasks = useCallback(async () => {
    if (!supabaseId) return;
    try {
      setTasks(await getTasks(supabaseId));
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }, [supabaseId]);

  useEffect(() => {
    loadFriends();
    loadTasks();
  }, [loadFriends, loadTasks]);

  async function toggleTask(id) {
    const currentTask = tasks.find((task) => task.id === id);
    if (!supabaseId || !currentTask) return;
    try {
      const updated = await updateTask(supabaseId, id, { completed: !currentTask.done });
      setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }

  async function removeTask(id) {
    if (!supabaseId) return;
    try {
      await deleteTask(supabaseId, id);
      setTasks((current) => current.filter((task) => task.id !== id));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = capitalize(profile?.first_name) || "there";
  const streak = profile?.current_streak ?? 0;
  const friendsOnline = friends.filter(({ user }) => user.is_online).length;
  const nextTask = tasks.find((task) => !task.done);

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