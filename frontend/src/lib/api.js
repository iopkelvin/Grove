import { supabase } from "./supabaseClient";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * fetch() against the Grove API with the Supabase access token attached.
 * The backend takes the caller's identity from that token, so anything
 * touching a user's own data has to go through here.
 */
export async function apiFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
