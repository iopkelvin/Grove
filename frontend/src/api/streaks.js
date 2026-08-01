const API_URL = import.meta.env.VITE_API_URL;
// fetches tree progress from database.
export async function getTreeProgress(supabaseId) {
  const res = await fetch(`${API_URL}/api/streaks/${supabaseId}`);
  if (!res.ok) throw new Error("Could not load tree progress");
  return res.json();
}
