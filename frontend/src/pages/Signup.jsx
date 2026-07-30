await fetch(`${import.meta.env.VITE_API_URL}/api/users/sync`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    supabase_id: data.user.id,
    email: data.user.email,
    username: data.user.email.split("@")[0],
  }),
});