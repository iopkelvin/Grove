// Auth session + the signed-in user's profile.
//
// The previous version had three problems worth naming, because all three
// showed up as "the app is subtly wrong and nobody knows why":
//
//   1. A failed profile fetch logged to the console and left `profile` at
//      whatever it was before, so a signed-in user could sit forever on a
//      page that had no idea who they were.
//   2. `loading` went false as soon as the session resolved, before the
//      profile arrived, so pages rendered one frame with a name of "there".
//   3. Nothing distinguished "signed out" from "signed in but the profile
//      request failed", so the auth gate could not tell them apart.
//
// This version tracks the profile's own state, and exposes a retry.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { getMyProfile, updateMyProfile } from "../api/users";
import { getFriendsSummary } from "../api/friends";
import { ApiError } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

const UserContext = createContext(null);

const EMPTY_SUMMARY = { total: 0, online: 0, pending_incoming: 0 };

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [friendsSummary, setFriendsSummary] = useState(EMPTY_SUMMARY);

  // Guards against a slow response for a previous user landing after a
  // faster one for the current user and overwriting it.
  const requestSequence = useRef(0);

  const loadProfile = useCallback(async (activeSession) => {
    if (!activeSession) {
      setProfile(null);
      setProfileError(null);
      setFriendsSummary(EMPTY_SUMMARY);
      return;
    }

    const sequence = ++requestSequence.current;
    setProfileLoading(true);
    setProfileError(null);

    try {
      const [me, summary] = await Promise.all([
        getMyProfile(),
        // A failed summary must not take the profile down with it; the
        // Friends card degrades to zeroes.
        getFriendsSummary().catch(() => EMPTY_SUMMARY),
      ]);
      if (sequence !== requestSequence.current) return;
      setProfile(me);
      setFriendsSummary(summary);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setProfile(null);
      setProfileError(error);
      // A user whose Supabase account exists but whose Grove row does not
      // has a stale local session; clearing it sends them back to signup
      // rather than leaving them stuck on a page that cannot load.
      if (error instanceof ApiError && error.code === "account_not_synced") {
        await supabase.auth.signOut();
      }
    } finally {
      if (sequence === requestSequence.current) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
      loadProfile(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setSessionLoading(false);
      loadProfile(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session]);

  const refreshFriendsSummary = useCallback(async () => {
    if (!session) return;
    try {
      setFriendsSummary(await getFriendsSummary());
    } catch {
      // A badge count is not worth surfacing an error for.
    }
  }, [session]);

  const updateProfile = useCallback(async (updates) => {
    const updated = await updateMyProfile(updates);
    setProfile(updated);
    return updated;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setFriendsSummary(EMPTY_SUMMARY);
  }, []);

  const value = {
    session,
    // True until we know both who is signed in and, if anyone is, who they
    // are. Pages can render one loading state instead of two.
    loading: sessionLoading || profileLoading,
    isAuthenticated: Boolean(session),
    profile,
    profileError,
    friendsSummary,
    pendingRequestCount: friendsSummary.pending_incoming,
    logout,
    updateProfile,
    refreshProfile,
    refreshFriendsSummary,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    // Without this, a component rendered outside the provider fails much
    // later with "cannot destructure property 'session' of null".
    throw new Error("useUser must be used inside a <UserProvider>");
  }
  return context;
}
