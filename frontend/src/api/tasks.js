const API_URL = import.meta.env.VITE_API_URL;

export async function getTasks(supabaseId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  const res = await fetch(`${API_URL}/api/tasks?${params}`);
  return res.ok ? res.json() : [];
}

export async function createTask(supabaseId, { title, description, tags } = {}) {
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabase_id: supabaseId, title, description, tags }),
  });
  return res;
}

export async function updateTask(taskId, supabaseId, fields) {
  const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabase_id: supabaseId, ...fields }),
  });
  return res;
}

export async function deleteTask(taskId, supabaseId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  const res = await fetch(`${API_URL}/api/tasks/${taskId}?${params}`, {
    method: "DELETE",
  });
  return res;
}
