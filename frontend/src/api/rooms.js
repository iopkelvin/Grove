import { apiFetch } from "./client";

const SETTING_IMAGES = {
  mars: "/assets/mars-placeholder.svg",
  library: "/assets/library-placeholder.svg",
  campsite: "/assets/Study-Room.png",
};

export function roomImageFor(room) {
  return room.image || SETTING_IMAGES[room.setting] || SETTING_IMAGES.campsite;
}

export async function getRooms(supabaseId) {
  const params = new URLSearchParams();
  if (supabaseId) params.set("supabase_id", supabaseId);
  const res = await apiFetch(`/api/rooms?${params}`);
  if (!res.ok) throw new Error("Could not load rooms");
  return res.json();
}

export async function getRoom(roomId) {
  const res = await apiFetch(`/api/rooms/${roomId}`);
  if (!res.ok) throw new Error("Could not load room");
  return res.json();
}

export async function createRoom(payload) {
  const res = await apiFetch("/api/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not create room");
  }
  return res.json();
}

export async function visitRoom(roomId) {
  return apiFetch(`/api/rooms/${roomId}/visit`, { method: "POST" });
}
