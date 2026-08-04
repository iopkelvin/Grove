import { apiFetch } from "./client";

const ROOM_SETTINGS = {
  campsite: {
    image: "/assets/Study-Room.png",
    sound: "/assets/sound/campsite.mp3",
  },
  mars: {
    image: "/assets/wallpapers/mars-1.jpg",
    sound: "/assets/sound/mars.mp3",
  },
  library: {
    image: "/assets/wallpapers/library-1.jpg",
    sound: "/assets/sound/library.mp3",
  },
};

export const ROOM_SETTING_KEYS = Object.keys(ROOM_SETTINGS);

function settingAssets(setting) {
  return ROOM_SETTINGS[setting] || ROOM_SETTINGS.campsite;
}

// Custom upload wins if the host set one; otherwise fall back to the
// setting's curated default art.
export function roomImageFor(room) {
  return room.wallpaper_url || settingAssets(room.setting).image;
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

export async function setRoomWallpaper(roomId, wallpaperUrl) {
  const res = await apiFetch(`/api/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify({ wallpaper_url: wallpaperUrl }),
  });
  if (!res.ok) throw new Error("Could not update room wallpaper");
  return res.json();
}

// Also clears any custom wallpaper server-side — a new setting means a new
// default background, so a leftover custom image from the old one would
// otherwise silently keep showing instead.
export async function setRoomSetting(roomId, setting) {
  const res = await apiFetch(`/api/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify({ setting }),
  });
  if (!res.ok) throw new Error("Could not change the room background");
  return res.json();
}

export async function inviteRoomMembers(roomId, userIds) {
  const res = await apiFetch(`/api/rooms/${roomId}/invite`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not invite friends");
  }
  return res.json();
}

export async function deleteRoom(roomId) {
  const res = await apiFetch(`/api/rooms/${roomId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not delete room");
  }
}

export async function removeRoomMember(roomId, userId) {
  const res = await apiFetch(`/api/rooms/${roomId}/members/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not remove member");
  }
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
