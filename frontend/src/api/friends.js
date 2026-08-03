import { apiFetch } from "./client";

export async function searchUsers(query, excludeSupabaseId) {
  const params = new URLSearchParams({ q: query });
  if (excludeSupabaseId) params.set("exclude_supabase_id", excludeSupabaseId);

  const res = await apiFetch(`/api/users/search?${params}`);
  return res.ok ? res.json() : [];
}

export async function getFriends(supabaseId, { status = "accepted", direction } = {}) {
  const params = new URLSearchParams({ supabase_id: supabaseId, status });
  if (direction) params.set("direction", direction);

  const res = await apiFetch(`/api/friends?${params}`);
  return res.ok ? res.json() : [];
}

export async function sendFriendRequest(requesterSupabaseId, targetUserId) {
  return apiFetch("/api/friends", {
    method: "POST",
    body: JSON.stringify({
      requester_supabase_id: requesterSupabaseId,
      target_user_id: targetUserId,
    }),
  });
}

// Classifies a friendship into one of three UI states so pages don't each
// hand-roll the same pending/accepted/none mapping.
export function getFriendshipState(friendshipStatus, alreadyRequested) {
  if (alreadyRequested || friendshipStatus === "pending") return "requested";
  if (friendshipStatus === "accepted") return "friends";
  return "none";
}

export async function sendFriendRequestOrError(requesterSupabaseId, targetUserId) {
  try {
    const res = await sendFriendRequest(requesterSupabaseId, targetUserId);
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || "Failed to send friend request." };
  } catch {
    return { ok: false, error: "Failed to send friend request. Please try again." };
  }
}

export async function respondToFriendRequest(friendshipId, supabaseId, status) {
  return apiFetch(`/api/friends/${friendshipId}`, {
    method: "PATCH",
    body: JSON.stringify({ supabase_id: supabaseId, status }),
  });
}

export async function removeFriend(friendshipId, supabaseId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  return apiFetch(`/api/friends/${friendshipId}?${params}`, { method: "DELETE" });
}
