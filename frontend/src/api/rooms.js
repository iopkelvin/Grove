import { apiFetch } from "./client";

const SETTING_IMAGES = {
  mars: "/assets/mars-placeholder.svg",
  library: "/assets/library-placeholder.svg",
  campsite: "/assets/Study-Room.png",
};

// Custom upload wins if the host set one; otherwise fall back to the
// setting's curated default art.
export function roomImageFor(room) {
  return room.wallpaper_url || room.image || SETTING_IMAGES[room.setting] || SETTING_IMAGES.campsite;
}

const DEFAULT_WALLPAPERS = {
  campsite: ["/assets/wallpapers/campsite-1.jpg", "/assets/wallpapers/campsite-2.jpg"],
  mars: ["/assets/wallpapers/mars-1.jpg", "/assets/wallpapers/mars-2.jpg"],
  library: ["/assets/wallpapers/library-1.jpg", "/assets/wallpapers/library-2.jpg"],
};

export function defaultWallpapersFor(setting) {
  return DEFAULT_WALLPAPERS[setting] || DEFAULT_WALLPAPERS.campsite;
}

const SETTING_SOUNDS = {
  mars: "/assets/sound/mars.mp3",
  library: "/assets/sound/library.mp3",
  campsite: "/assets/sound/campsite.mp3",
};

export function roomSoundFor(room) {
  return SETTING_SOUNDS[room.setting] || SETTING_SOUNDS.campsite;
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

// Presence heartbeat for the shared room ember — call every few seconds
// while the local focus timer is running. Returns how many people are
// currently focusing together in the room right now.
export async function pingRoomFocus(roomId) {
  const res = await apiFetch(`/api/rooms/${roomId}/focus-ping`, { method: "POST" });
  if (!res.ok) throw new Error("Could not send focus ping");
  return res.json();
}

export async function setRoomWallpaper(roomId, wallpaperUrl) {
  const res = await apiFetch(`/api/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify({ wallpaper_url: wallpaperUrl }),
  });
  if (!res.ok) throw new Error("Could not update room wallpaper");
  return res.json();
}

export async function getRoomMessages(roomId, afterId) {
  const params = new URLSearchParams();
  if (afterId) params.set("after_id", afterId);
  const res = await apiFetch(`/api/rooms/${roomId}/messages?${params}`);
  if (!res.ok) throw new Error("Could not load messages");
  return res.json();
}

export async function sendRoomMessage(roomId, body) {
  const res = await apiFetch(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not send message");
  }
  return res.json();
}
