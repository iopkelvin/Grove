// Supabase client (authentication + image storage).
//
// createClient() with an undefined URL throws "supabaseUrl is required" from
// deep inside the library, during module evaluation, before React has
// mounted anything — so a missing frontend/.env presents as a blank white
// page with a stack trace nobody outside the project can interpret. That is
// the single most likely thing to go wrong for a teammate or a grader
// setting this up for the first time, so it gets an explicit check.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : "Supabase is not configured. Copy frontend/.env.example to frontend/.env and fill in " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase dashboard > Settings > API), " +
    "then restart the dev server.";

// A stub with the same shape when configuration is missing, so the app still
// boots and can render the message above instead of dying at import time.
const stub = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ error: { message: supabaseConfigError } }),
    signUp: async () => ({ error: { message: supabaseConfigError } }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ error: { message: supabaseConfigError } }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The access token is what the backend verifies, so letting the
        // client refresh it before expiry is what keeps a long session from
        // suddenly getting 401s mid-use.
        detectSessionInUrl: true,
      },
    })
  : stub;
