// Friendship endpoints.

import { api } from "../lib/apiClient";

/**
 * @param {object} [options]
 * @param {"accepted"|"pending"|"declined"} [options.status]
 * @param {"incoming"|"sent"} [options.direction] only meaningful for pending
 */
export function getFriends({ status = "accepted", direction } = {}) {
  return api.get("/api/friends", { params: { status, direction } });
}

/** Counts for the Home page's Friends card, in one request. */
export function getFriendsSummary() {
  return api.get("/api/friends/summary");
}

export function sendFriendRequest(targetUserId) {
  return api.post("/api/friends", { target_user_id: targetUserId });
}

export function respondToFriendRequest(friendshipId, status) {
  return api.patch(`/api/friends/${friendshipId}`, { status });
}

export function removeFriend(friendshipId) {
  return api.delete(`/api/friends/${friendshipId}`);
}
