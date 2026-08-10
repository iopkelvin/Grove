import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { firstNameOf } from "../lib/format";
import { getTreeCycleLevel } from "../lib/treeCycle";
import { getRoom, createRoom } from "../api/rooms";
import { getFriends } from "../api/friends";
import { useTasks } from "../hooks/useTasks";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import MiniCalendar from "../components/MiniCalendar";
import ContinueRoomCard from "../components/ContinueRoomCard";
import StudyRoomsCard from "../components/StudyRoomsCard";
import CreateRoomModal from "../components/CreateRoomModal";
import CreateTaskCard from "../components/CreateTaskCard";
import TaskList from "../components/TaskList";
import TaskFormModal from "../components/TaskFormModal";
import UndoToast from "../components/UndoToast";
import HomeTutorial from "../components/HomeTutorial";
import useHomeTutorial from "../hooks/useHomeTutorial";
import useStreakLevelUp from "../hooks/useStreakLevelUp";

// Incomplete tasks, soonest due first (no due date sorts last); same-day
// tasks are ordered by due time. The widget itself scrolls past 5 rows
// (see .grid-item-upnext .task-list in tasks.css) rather than truncating here.
function pickUpNext(tasks) {
  const incomplete = tasks.filter((task) => !task.done);
  return [...incomplete].sort((a, b) => {
    const dateA = a.due_date || "9999-99-99";
    const dateB = b.due_date || "9999-99-99";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.due_time || "99:99";
    const timeB = b.due_time || "99:99";
    return timeA.localeCompare(timeB);
  });
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
  const treeLevel = getTreeCycleLevel(streak);
  const streakLeveledUp = useStreakLevelUp(supabaseId, streak);

  const [lastRoom, setLastRoom] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const { tasks, addTask, toggleTask, removeTask, pendingDelete, undoDelete } = useTasks(supabaseId);

  useEffect(() => {
    if (!profile?.last_room_id) {
      setLastRoom(null);
      return;
    }
    getRoom(profile.last_room_id)
      .then(setLastRoom)
      .catch(() => setLastRoom(null));
  }, [profile?.last_room_id]);

  useEffect(() => {
    if (!supabaseId) return;
    getFriends(supabaseId)
      .then((result) => setFriends(result.map((entry) => entry.user)))
      .catch(() => setFriends([]));
  }, [supabaseId]);

  async function handleCreateRoom(formValues) {
    setCreatingRoom(true);
    setCreateRoomError("");
    try {
      const room = await createRoom({
        host_supabase_id: supabaseId,
        name: formValues.name,
        setting: formValues.setting,
        music_enabled: formValues.music_enabled,
        chat_enabled: formValues.chat_enabled,
        focus_minutes: formValues.focus_minutes,
        invite_user_ids: formValues.invite_user_ids,
      });
      setShowRoomModal(false);
      sessionStorage.setItem(`grove-room-${room.id}`, JSON.stringify(room));
      navigate(`/rooms/${room.id}`, { state: { room } });
    } catch (error) {
      setCreateRoomError(error.message);
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleCreateTask(fields) {
    setSubmittingTask(true);
    const ok = await addTask(fields.title, {
      description: fields.description,
      tags: fields.tags,
      dueDate: fields.dueDate,
      dueTime: fields.dueTime,
      recurring: fields.recurring,
    });
    setSubmittingTask(false);
    if (ok) setShowTaskModal(false);
  }

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  const firstName = firstNameOf(profile);
  const upNext = pickUpNext(tasks);

  return (
    <div className="page">
      <MenuIcon />

      <h1 className="page-title">{greeting}, {firstName}</h1>

      <div className="grid">
        <div className="grid-item-tree" data-home-tour="streak">
          <StreakTree streak={treeLevel} userId={supabaseId} glow={streakLeveledUp} />
        </div>

        <div className="grid-item-columns">
          <div className="grid-item-middle">
            <div className="grid-item-calendar" data-home-tour="calendar">
              <MiniCalendar tasks={tasks} />
            </div>

            <ContinueRoomCard className="grid-item-continue" room={lastRoom} />

            <StudyRoomsCard
              className="grid-item-rooms"
              onCreate={() => setShowRoomModal(true)}
              creating={creatingRoom}
            />
          </div>

          <div className="grid-item-right">
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

            <CreateTaskCard className="grid-item-create-task" onCreate={() => setShowTaskModal(true)} />
          </div>
        </div>
      </div>

      {showTutorial && (
        <HomeTutorial
          onComplete={completeTutorial}
          onClose={closeTutorial}
        />
      )}

      {showTaskModal && (
        <TaskFormModal
          supabaseId={supabaseId}
          onClose={() => setShowTaskModal(false)}
          onSubmit={handleCreateTask}
          creating={submittingTask}
        />
      )}

      {showRoomModal && (
        <CreateRoomModal
          friends={friends}
          onClose={() => setShowRoomModal(false)}
          onCreate={handleCreateRoom}
          creating={creatingRoom}
          error={createRoomError}
        />
      )}
    </div>
  );
}

export default Home;
