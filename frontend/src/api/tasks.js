const API_URL = import.meta.env.VITE_API_URL;

export async function getTasks(supabaseId, { completed } = {}) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  if (typeof completed === "boolean") params.set("completed", String(completed));

  const res = await fetch(`${API_URL}/api/tasks?${params}`);
  if (!res.ok) throw new Error("Could not load tasks");
  return res.json();
}

export async function createTask(supabaseId, title, tags = [], description) {
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabase_id: supabaseId, title, description, tags }),
  });
  if (!res.ok) throw new Error("Could not create task");
  return res.json();
}

export async function updateTask(supabaseId, taskId, updates) {
  const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabase_id: supabaseId, ...updates }),
  });
  if (!res.ok) throw new Error("Could not update task");
  return res.json();
}

export async function deleteTask(supabaseId, taskId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  const res = await fetch(`${API_URL}/api/tasks/${taskId}?${params}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Could not delete task");
}
