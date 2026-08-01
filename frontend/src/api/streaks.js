// Streak endpoints.

import { api } from "../lib/apiClient";

/**
 * Everything the Streaks page draws: current run, longest run, day-by-day
 * history and task totals, in one request.
 *
 * @param {object} [options]
 * @param {number} [options.days] history window, 7-366
 */
export function getMyStreak({ days } = {}) {
  return api.get("/api/streaks/me", { params: { days } });
}

/** Another user's headline numbers, for their profile. No history. */
export function getUserStreak(username) {
  return api.get(`/api/streaks/user/${encodeURIComponent(username)}`);
}
