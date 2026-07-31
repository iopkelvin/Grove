// Home.
//
// The layout was three columns of placeholders: a FriendsCard hard-coded to
// "0 Friends Online", an UpNextCard whose entire body was the text "Up Next
// Card", a CalendarWidget reading "Calendar Widget", and a TaskList rendered
// with no props so it always showed its empty state. Only the streak tree
// displayed anything real.
//
// Every card now loads its own data and says so while it does.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getTaskStats } from "../api/tasks";
import FriendsCard from "../components/FriendsCard";
import MenuIcon from "../components/MenuIcon";
import StreakTree from "../components/StreakTree";
import UpNextCard from "../components/UpNextCard";
import { ErrorState, LoadingState } from "../components/states";
import { useUser } from "../context/UserContext";
import { capitalize } from "../lib/format";

function greetingFor(hour) {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export default function Home() {
  const { session, loading, profile, profileError, refreshProfile } = useUser();
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getTaskStats());
    } catch {
      // The headline numbers are a nicety; the page is still useful without
      // them, so a failure here is not worth an error screen.
      setStats(null);
    }
  }, []);

  useEffect(() => {
    if (profile) loadStats();
  }, [profile, loadStats]);

  if (loading) {
    return (
      <div className="page">
        <MenuIcon />
        <LoadingState label="Loading your grove" />
      </div>
    );
  }

  // Signed in but the profile could not be fetched. Distinct from signed
  // out, which never reaches this component — RequireAuth handles that.
  if (profileError) {
    return (
      <div className="page">
        <MenuIcon />
        <div className="page-content">
          <ErrorState
            error={profileError}
            onRetry={refreshProfile}
            title="Could not load your profile"
          />
        </div>
      </div>
    );
  }

  const firstName = capitalize(profile?.first_name) || "there";
  const streak = profile?.current_streak ?? 0;

  return (
    <div className="page">
      <MenuIcon />
      <div className="page-content">
        <h1 className="page-title">
          {greetingFor(new Date().getHours())}, {firstName}
        </h1>

        <div className="grid">
          <Link to="/streaks" className="card home-streak-card">
            <StreakTree streak={streak} userId={session?.user?.id} />
          </Link>

          <div className="grid-column">
            <FriendsCard />
            {stats && (
              <div className="card home-stats">
                <h2 className="card-title">Today</h2>
                <ul className="home-stats-list">
                  <li>
                    <strong>{stats.open}</strong> open
                  </li>
                  <li>
                    <strong>{stats.due_today}</strong> due today
                  </li>
                  <li className={stats.overdue > 0 ? "home-stat-alert" : undefined}>
                    <strong>{stats.overdue}</strong> overdue
                  </li>
                  <li>
                    <strong>{stats.completed_this_week}</strong> done this week
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="grid-column">
            <UpNextCard onChanged={loadStats} />
          </div>
        </div>
      </div>
    </div>
  );
}
