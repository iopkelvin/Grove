import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, Flame, Sprout } from "lucide-react";
import MenuIcon from "../components/MenuIcon";
import { useUser } from "../context/UserContext";
import { getTasks } from "../api/tasks";
import { getTreeProgress } from "../api/streaks";

const FALLBACK_PROGRESS = {
  points: 0,
  current_streak: 0,
  tree_level: 1,
  max_tree_level: 7,
  next_level_points: 3,
  points_remaining: 3,
};

// PLACEHOLDER TASK: shown only when no database task is available. It keeps
// the tree call-to-action understandable on a brand-new account.
// placeholder task, to be deleted for production.
const PLACEHOLDER_TASK = { id: "placeholder-water-task", title: "Finish one task today" };


// important documentation: 
// useState - component states and functional updates
// useEffect - API loading, synchronization, arrays, and cleanup functions
// useMemo  - caches friends and percentages.
// DOCUMENTATION
// https://react.dev/reference/react/useState
// https://react.dev/reference/react/useEffect
// https://react.dev/reference/react/useMemo
export default function Streaks() {
  const { session } = useUser();
  const [progress, setProgress] = useState(FALLBACK_PROGRESS);
  const [tasks, setTasks] = useState([]);
  const [watered, setWatered] = useState(false);

  useEffect(() => {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return;

    Promise.allSettled([getTreeProgress(supabaseId), getTasks(supabaseId, { completed: false })])
      .then(([progressResult, taskResult]) => {
        if (progressResult.status === "fulfilled") setProgress(progressResult.value);
        if (taskResult.status === "fulfilled") setTasks(taskResult.value);
      });
  }, [session?.user?.id]);

  const level = Math.max(1, Math.min(7, progress.tree_level || 1));
  const previewLevel = Math.max(1, Math.min(6, level + 1));
  const nextTask = tasks[0] || PLACEHOLDER_TASK;
  const atMaxLevel = level >= (progress.max_tree_level || 7);

  const progressPercent = useMemo(() => {
    if (atMaxLevel) return 100;
    const currentLevelStart = [0, 0, 3, 7, 12, 18, 25, 33][level] || 0;
    const range = Math.max(1, progress.next_level_points - currentLevelStart);
    return Math.max(0, Math.min(100, ((progress.points - currentLevelStart) / range) * 100));
  }, [atMaxLevel, level, progress.next_level_points, progress.points]);

  return (
    <div className="page tree-page">
      <MenuIcon />
      <main className="tree-shell">
        <header className="tree-header">
          <div>
            <p className="study-eyebrow">Your daily growth</p>
            <h1>Your Tree</h1>
          </div>
          <div className="tree-scoreboard">
            <span><Flame size={18} /> {progress.current_streak} day streak</span>
            <strong>{progress.points} points</strong>
          </div>
        </header>

        <section className="tree-art-stage">
          <img className="tree-stage-background" src="/assets/background-for-tree.png" alt="Night garden background" />
          <img
            className={`tree-main-art ${watered ? "is-watered" : ""}`}
            src={`/assets/transparent-tree-${level}.png`}
            alt={`Tree growth level ${level}`}
          />
          {watered && <span className="tree-water-sparkles" aria-hidden="true">✦ ✧ ✦</span>}

          <aside className="tree-progress-card">
            <p className="study-eyebrow">Next growth</p>
            <img src={`/assets/icon-tree-${previewLevel}.png`} alt={`Preview of tree level ${Math.min(level + 1, 7)}`} />
            <h2>{atMaxLevel ? "Your tree is fully grown" : `${progress.points_remaining} points to level ${level + 1}`}</h2>
            <div className="tree-progress-track" aria-label={`${Math.round(progressPercent)} percent to next level`}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <small>Each completed task adds 1 point. Complete a task each day to continue your streak.</small>
          </aside>

          <aside className="tree-water-card">
            <Droplets size={28} />
            <p className="study-eyebrow">Today</p>
            <h2>Water your tree!</h2>
            <p>Finish this task to earn another point:</p>
            <strong>{nextTask.title}</strong>
            <button onClick={() => setWatered(true)} disabled={watered}>
              {watered ? "Tree watered" : "Water the tree"}
            </button>
            <Link to="/tasks">Open tasks</Link>
          </aside>

          <div className="tree-level-badge">
            <Sprout size={18} /> Tree level {level}
          </div>
        </section>
      </main>
    </div>
  );
}
