import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../api/client";

// Derives first/last name from whatever shape the OAuth provider gives us —
// Google typically sends given_name/family_name, but falls back gracefully
// if only a combined name (or nothing) is available.
function namesFromMetadata(user) {
  const meta = user.user_metadata || {};
  if (meta.given_name || meta.family_name) {
    return [meta.given_name || "", meta.family_name || ""];
  }
  const fullName = meta.full_name || meta.name || "";
  // split on whitespace, drop empty tokens, first word is first name, rest rejoin as last name
  const [first, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
  return [first || user.email.split("@")[0], rest.join(" ")];
}

function AuthCallback() {
  const navigate = useNavigate();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // guards against React StrictMode's double-invoke
    ranRef.current = true;

    async function syncAndRedirect() {
      // supabase-js already parsed the redirect URL's tokens into a session by this point
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        navigate("/login");
        return;
      }

      const [firstName, lastName] = namesFromMetadata(user);

      try {
        const res = await apiFetch("/api/users/sync", {
          method: "POST",
          body: JSON.stringify({
            supabase_id: user.id,
            email: user.email,
            username: user.email.split("@")[0],
            first_name: firstName,
            last_name: lastName,
          }),
        });
        if (!res.ok) throw new Error(`sync failed with status ${res.status}`);
      } catch (syncError) {
        console.error("Failed to sync user with backend:", syncError);
      }

      navigate("/");
    }

    syncAndRedirect();
  }, [navigate]);

  return <div className="page">Signing you in...</div>;
}

export default AuthCallback;
