import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";
import { getRoom, createRoom } from "../api/rooms";
import { useTasks } from "../hooks/useTasks";
import { getTreeSeason } from "../utils/treeGenerator";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import MiniCalendar from "../components/MiniCalendar";
import ContinueRoomCard from "../components/ContinueRoomCard";
import StudyRoomsCard from "../components/StudyRoomsCard";
import TaskList from "../components/TaskList";
import UndoToast from "../components/UndoToast";
import HomeTutorial from "../components/HomeTutorial";
import useHomeTutorial from "../hooks/useHomeTutorial";
import useStreakLevelUp from "../hooks/useStreakLevelUp";

// Top few incomplete tasks, soonest due first (no due date sorts last);
// same-day tasks are ordered by due time.
function pickUpNext(tasks, count = 5) {
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
  const navigate = useNavigate();
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
  const [creatingRoom, setCreatingRoom] = useState(false);
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

  async function handleCreateRoom() {
    setCreatingRoom(true);
    try {
      const room = await createRoom({
        name: `${firstName}'s Room`,
        setting: "campsite",
        music_enabled: true,
        chat_enabled: true,
        focus_minutes: 50,
        invite_user_ids: [],
      });
      sessionStorage.setItem(`grove-room-${room.id}`, JSON.stringify(room));
      navigate(`/rooms/${room.id}`, { state: { room } });
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setCreatingRoom(false);
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = capitalize(profile?.first_name) || "there";
  const upNext = pickUpNext(tasks);

  return (
    <div className="page">
      <MenuIcon />

      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <div className="grid-item-tree" data-home-tour="streak">
          <StreakTree streak={streak} userId={supabaseId} layout="overlay" glow={streakLeveledUp} />
        </div>

        <div className="grid-item-calendar" data-home-tour="calendar">
          <MiniCalendar tasks={tasks} season={season} />
        </div>

        <StudyRoomsCard
          className="grid-item-rooms"
          onCreate={handleCreateRoom}
          creating={creatingRoom}
        />

        <div className="grid-item-upnext" data-home-tour="up-next">
          <TaskList
            title="Up Next"
            tasks={upNext}
            onToggle={toggleTask}
            onDelete={removeTask}
            emptyMessage="All caught up!"
          />
          <UndoToast task={pendingDelete} onUndo={undoDelete} />
        </div>

        <ContinueRoomCard className="grid-item-continue" room={lastRoom} />
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
