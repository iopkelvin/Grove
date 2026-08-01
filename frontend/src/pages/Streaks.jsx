// Streaks.
//
// This file was zero bytes. The menu linked to /streaks, the route was never
// registered, and clicking it rendered nothing.
//
// The page answers three questions the number on the home page cannot: how
// long is the current run, how long was the best one, and which days did I
// actually show up.

import { useCallback, useEffect, useState } from "react";
import { Flame, Sprout, TrendingUp } from "lucide-react";

import { getMyStreak } from "../api/streaks";
import PageLayout from "../components/PageLayout";
import StreakHeatmap from "../components/StreakHeatmap";
import StreakTree from "../components/StreakTree";
import { AsyncBoundary, EmptyState } from "../components/states";
import { useUser } from "../context/UserContext";

export default function Streaks() {
  const { session } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMyStreak({ days: 91 }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasHistory = Boolean(data?.total_days);

  return (
    <PageLayout title="Streaks" subtitle="One completed task a day keeps the tree growing.">
      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={load}
        loadingLabel="Loading your streak"
      >
        {data && (
          <div className="streaks-layout">
            <section className="card streaks-tree-card">
              <StreakTree streak={data.current_count} userId={session?.user?.id} />
              {/* Only shown when it is actionable — there is no point
                  nagging somebody who has already logged today. */}
              {data.at_risk && (
                <p className="streaks-warning" role="status">
                  Your streak is still alive, but today is not logged yet.
                </p>
              )}
            </section>

            <div className="streaks-stats">
              <StatCard
                icon={Flame}
                label="Current streak"
                value={data.current_count}
                unit={data.current_count === 1 ? "day" : "days"}
              />
              <StatCard
                icon={TrendingUp}
                label="Longest streak"
                value={data.longest_count}
                unit={data.longest_count === 1 ? "day" : "days"}
              />
              <StatCard icon={Sprout} label="Active days" value={data.total_days} unit="total" />
              <StatCard
                icon={Sprout}
                label="Tasks completed"
                value={data.tasks_completed}
                unit="all time"
              />
            </div>

            <section className="card streaks-history-card">
              <h2 className="card-title">The last 13 weeks</h2>
              {hasHistory ? (
                <StreakHeatmap history={data.history} />
              ) : (
                <EmptyState
                  title="No activity recorded yet"
                  hint="Complete a task on the Tasks page and this fills in."
                />
              )}
            </section>
          </div>
        )}
      </AsyncBoundary>
    </PageLayout>
  );
}

function StatCard({ icon: Icon, label, value, unit }) {
  return (
    <div className="card streaks-stat">
      <Icon size={20} aria-hidden="true" />
      <span className="streaks-stat-value">{value}</span>
      <span className="streaks-stat-label">{label}</span>
      <span className="streaks-stat-unit">{unit}</span>
    </div>
  );
}
