import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../api/client";
import { getFriends } from "../api/friends";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const fetchProfile = useCallback(async (supabaseId) => {
    if (!supabaseId) {
      setProfile(null);
      return;
    }
    try {
      const res = await apiFetch(`/api/users/${supabaseId}`);
      setProfile(res.ok ? await res.json() : null);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }, []);

  const refreshPendingRequestCount = useCallback(async (supabaseId) => {
    if (!supabaseId) {
      setPendingRequestCount(0);
      return;
    }
    try {
      const requests = await getFriends(supabaseId, { status: "pending" });
      setPendingRequestCount(requests.length);
    } catch (err) {
      console.error("Failed to load friend requests:", err);
    }
  }, []);

  const lastUserId = useRef(undefined);

  useEffect(() => {
    // Supabase also fires this listener on silent token refreshes, which
    // happen periodically for a still-signed-in user. Only refetch profile
    // and pending requests when the signed-in user actually changes (sign
    // in, sign out, switch account) — not on every token refresh.
    function handleSession(newSession) {
      setSession(newSession);
      const userId = newSession?.user?.id;
      if (userId === lastUserId.current) return;
      lastUserId.current = userId;
      fetchProfile(userId);
      refreshPendingRequestCount(userId);
    }

    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchProfile, refreshPendingRequestCount]);

  async function logout() {
    // scope: "local" clears this browser's session directly instead of
    // asking Supabase's server to invalidate it first — the default
    // "global" scope leaves the user stuck logged in if the server ever
    // says the session's already gone (e.g. after token/session rotation),
    // since the SDK doesn't fall back to a local clear on that failure.
    await supabase.auth.signOut({ scope: "local" });
  }

  async function updateProfile(updates) {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return { ok: false };

    const res = await apiFetch(`/api/users/${supabaseId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      setProfile(await res.json());
    }
    return res;
  }

  async function refreshProfile(supabaseId) {
    await fetchProfile(supabaseId ?? session?.user?.id);
  }

  async function refreshPendingRequests() {
    await refreshPendingRequestCount(session?.user?.id);
  }

  return (
    <UserContext.Provider
      value={{
        session,
        loading,
        profile,
        logout,
        updateProfile,
        refreshProfile,
        pendingRequestCount,
        refreshPendingRequests,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}