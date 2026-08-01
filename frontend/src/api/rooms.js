const API_URL = import.meta.env.VITE_API_URL;
// added CRUD operations to the rooms controller section.
// aded get rooms, get room , create room, 
export async function getRooms(supabaseId) {
  const params = new URLSearchParams();
  if (supabaseId) params.set("supabase_id", supabaseId);
  const res = await fetch(`${API_URL}/api/rooms?${params}`);
  if (!res.ok) throw new Error("Could not load rooms");
  return res.json();
}

export async function getRoom(roomId) {
  const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
  if (!res.ok) throw new Error("Could not load room");
  return res.json();
}

export async function createRoom(payload) {
  const res = await fetch(`${API_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not create room");
  }
  return res.json();
}
