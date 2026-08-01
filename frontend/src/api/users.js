import { apiFetch } from "./client";

export async function getUserByUsername(username, viewerSupabaseId) {
  const params = viewerSupabaseId
    ? `?${new URLSearchParams({ viewer_supabase_id: viewerSupabaseId })}`
    : "";
  const res = await apiFetch(`/api/users/by-username/${encodeURIComponent(username)}${params}`);
  return res.ok ? res.json() : null;
}
