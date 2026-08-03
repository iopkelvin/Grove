import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../api/client";
import { getFriends } from "../api/friends";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);

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

  const loadPendingRequests = useCallback(async (supabaseId) => {
    if (!supabaseId) {
      setPendingRequests([]);
      return;
    }
    try {
      setPendingRequests(await getFriends(supabaseId, { status: "pending" }));
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
      loadPendingRequests(userId);
    }

    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchProfile, loadPendingRequests]);

  async function logout() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      // Known gap in @supabase/auth-js: when the server says the session
      // is already gone ("session_not_found"), it's wrapped as an
      // AuthSessionMissingError instead of AuthApiError — which fails the
      // SDK's own "ignore this and clear locally anyway" check inside
      // signOut(), so the local session/localStorage token never gets
      // cleared and the user stays stuck logged in. Force it ourselves;
      // an error here means there's nothing valid left server-side, so
      // treating it as "already logged out" locally is correct either way.
      await supabase.auth._removeSession();
    }
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
    await loadPendingRequests(session?.user?.id);
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
        pendingRequests,
        pendingRequestCount: pendingRequests.length,
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