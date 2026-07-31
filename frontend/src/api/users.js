const API_URL = import.meta.env.VITE_API_URL;

export async function getUserByUsername(username, viewerSupabaseId) {
  const params = viewerSupabaseId
    ? `?${new URLSearchParams({ viewer_supabase_id: viewerSupabaseId })}`
    : "";
  const res = await fetch(`${API_URL}/api/users/by-username/${encodeURIComponent(username)}${params}`);
  return res.ok ? res.json() : null;
}
