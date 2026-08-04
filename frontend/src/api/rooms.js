import { apiFetch } from "./client";

const ROOM_SETTINGS = {
  campsite: {
    image: "/assets/Study-Room.png",
    wallpapers: ["/assets/wallpapers/campsite-1.jpg", "/assets/wallpapers/campsite-2.jpg"],
    sound: "/assets/sound/campsite.mp3",
  },
  mars: {
    image: "/assets/mars-placeholder.svg",
    wallpapers: ["/assets/wallpapers/mars-1.jpg", "/assets/wallpapers/mars-2.jpg"],
    sound: "/assets/sound/mars.mp3",
  },
  library: {
    image: "/assets/library-placeholder.svg",
    wallpapers: ["/assets/wallpapers/library-1.jpg", "/assets/wallpapers/library-2.jpg"],
    sound: "/assets/sound/library.mp3",
  },
};

function settingAssets(setting) {
  return ROOM_SETTINGS[setting] || ROOM_SETTINGS.campsite;
}

// Custom upload wins if the host set one; otherwise fall back to the
// setting's curated default art.
export function roomImageFor(room) {
  return room.wallpaper_url || settingAssets(room.setting).image;
}

export function defaultWallpapersFor(setting) {
  return settingAssets(setting).wallpapers;
}

export function roomSoundFor(room) {
  return settingAssets(room.setting).sound;
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

// Presence for the shared room ember. GET just reads the current count
// (for a paused viewer who isn't contributing); POST reports "I'm still
// focusing" and returns the resulting count — call every few seconds
// while the local focus timer is running.
export async function getRoomFocusCount(roomId) {
  const res = await apiFetch(`/api/rooms/${roomId}/focus-ping`);
  if (!res.ok) throw new Error("Could not read focus presence");
  return res.json();
}

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
