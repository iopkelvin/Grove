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
