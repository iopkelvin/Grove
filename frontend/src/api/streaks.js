import { apiFetch } from "../lib/api";

// fetches tree progress from database.
export async function getTreeProgress(supabaseId) {
  const res = await apiFetch(`/api/streaks/${supabaseId}`);
  if (!res.ok) throw new Error("Could not load tree progress");
  return res.json();
}
