import { apiFetch } from "../lib/api";

// supabase_id is still sent so a backend running without a JWT secret
// (no local setup) keeps working. When a secret is set it's ignored.

export async function getTasks(supabaseId, { completed } = {}) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  if (typeof completed === "boolean") params.set("completed", String(completed));

  const res = await apiFetch(`/api/tasks?${params}`);
  if (!res.ok) throw new Error("Could not load tasks");
  return res.json();
}

export async function createTask(supabaseId, title, { tags = [], description, dueDate, recurring } = {}) {
  const res = await apiFetch(`/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supabase_id: supabaseId,
      title,
      description,
      tags,
      due_date: dueDate,
      recurring,
    }),
  });
  if (!res.ok) throw new Error("Could not create task");
  return res.json();
}

export async function updateTask(supabaseId, taskId, updates) {
  const res = await apiFetch(`/api/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabase_id: supabaseId, ...updates }),
  });
  if (!res.ok) throw new Error("Could not update task");
  return res.json();
}

export async function deleteTask(supabaseId, taskId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  const res = await apiFetch(`/api/tasks/${taskId}?${params}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Could not delete task");
}

export async function getTags(supabaseId) {
  const params = new URLSearchParams({ supabase_id: supabaseId });
  const res = await apiFetch(`/api/tags?${params}`);
  if (!res.ok) throw new Error("Could not load tags");
  return res.json();
}
