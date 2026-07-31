import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchProfile = useCallback(async (supabaseId) => {
    if (!supabaseId) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${supabaseId}`);
      setProfile(res.ok ? await res.json() : null);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      fetchProfile(data.session?.user?.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      fetchProfile(newSession?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchProfile]);

  async function logout() {
    await supabase.auth.signOut();
  }

  async function updateProfile(updates) {
    const supabaseId = session?.user?.id;
    if (!supabaseId) return { ok: false };

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${supabaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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

  return (
    <UserContext.Provider value={{ session, loading, profile, logout, updateProfile, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}