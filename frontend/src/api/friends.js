const API_URL = import.meta.env.VITE_API_URL;

export async function searchUsers(query, excludeSupabaseId) {
  const params = new URLSearchParams({ q: query });
  if (excludeSupabaseId) params.set("exclude_supabase_id", excludeSupabaseId);

  const res = await fetch(`${API_URL}/api/users/search?${params}`);
  return res.ok ? res.json() : [];
}

export async function getFriends(supabaseId, { status = "accepted", direction } = {}) {
  const params = new URLSearchParams({ supabase_id: supabaseId, status });
  if (direction) params.set("direction", direction);

  const res = await fetch(`${API_URL}/api/friends?${params}`);
  return res.ok ? res.json() : [];
}

export async function sendFriendRequest(requesterSupabaseId, targetUserId) {
  const res = await fetch(`${API_URL}/api/friends`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requester_supabase_id: requesterSupabaseId,
      target_user_id: targetUserId,
    }),
  });
  return res;
}

export async function respondToFriendRequest(friendshipId, supabaseId, status) {
  const res = await fetch(`${API_URL}/api/friends/${friendshipId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabase_id: supabaseId, status }),
  });
  return res;
}

export async function removeFriend(friendshipId, supabaseId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  const res = await fetch(`${API_URL}/api/friends/${friendshipId}?${params}`, {
    method: "DELETE",
  });
  return res;
}
