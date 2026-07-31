// User and profile endpoints.

import { api } from "../lib/apiClient";

/** The signed-in user's own profile, including their email. */
export function getMyProfile() {
  return api.get("/api/users/me");
}

export function updateMyProfile(updates) {
  return api.patch("/api/users/me", updates);
}

/**
 * Create this Grove account after Supabase signup.
 *
 * supabase_id and email come from the verified token on the server side;
 * the body only carries what Supabase does not know about.
 */
export function syncAccount({ firstName, lastName, usernameSeed, email }) {
  return api.post("/api/users/sync", {
    first_name: firstName,
    last_name: lastName,
    username: usernameSeed,
    email,
  });
}

/** Public profile. Readable signed out; shows more to a signed-in viewer. */
export function getUserByUsername(username) {
  return api.get(`/api/users/by-username/${encodeURIComponent(username)}`);
}

export function searchUsers(query, { limit } = {}) {
  return api.get("/api/users/search", { params: { q: query, limit } });
}
