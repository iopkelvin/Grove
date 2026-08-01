import { supabase } from "../lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL;

// Shared by every api/*.js call. Attaches the signed-in user's Supabase
// access token so the backend can verify who's asking instead of trusting
// a client-submitted id. getSession() reads the SDK's local/cached
// session, so this doesn't add a network round trip on the common path.
export async function apiFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = { ...options.headers };
  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
