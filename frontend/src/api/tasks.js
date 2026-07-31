// Task endpoints.
//
// Identity is no longer a parameter. It travels in the Authorization header
// that apiClient attaches, so none of these functions can be called on
// somebody else's behalf by passing a different id.

import { api } from "../lib/apiClient";

/**
 * A page of the signed-in user's tasks.
 * @returns {Promise<{items: object[], total: number, limit: number, offset: number}>}
 */
export function getTasks({ completed, tag, q, sort, order, limit, offset } = {}) {
  return api.get("/api/tasks", {
    params: { completed, tag, q, sort, order, limit, offset },
  });
}

export function createTask({ title, description, tags, due_date }) {
  return api.post("/api/tasks", { title, description, tags, due_date });
}

export function updateTask(taskId, updates) {
  return api.patch(`/api/tasks/${taskId}`, updates);
}

export function deleteTask(taskId) {
  return api.delete(`/api/tasks/${taskId}`);
}

export function clearCompletedTasks() {
  return api.post("/api/tasks/clear-completed");
}

/** The few tasks the Home page's "Up Next" card shows. */
export function getUpNext() {
  return api.get("/api/tasks/up-next");
}

export function getTaskStats() {
  return api.get("/api/tasks/stats");
}

export function getTags() {
  return api.get("/api/tasks/tags");
}
