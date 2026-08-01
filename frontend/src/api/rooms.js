// Study room endpoints.
//
// These had no backend at all until this release — the routes were stubs
// that answered 500 — so there was no frontend client for them either.

import { api } from "../lib/apiClient";

/** Rooms the signed-in user can see, plus the list of valid themes. */
export function getRooms() {
  return api.get("/api/rooms");
}

/** The global study room and whether you are currently in it. */
export function getLobby() {
  return api.get("/api/rooms/lobby");
}

export function joinLobby() {
  return api.post("/api/rooms/lobby/join");
}

export function leaveLobby() {
  return api.post("/api/rooms/lobby/leave");
}

export function createRoom({ name, theme, capacity }) {
  return api.post("/api/rooms", { name, theme, capacity });
}

export function getRoom(roomId) {
  return api.get(`/api/rooms/${roomId}`);
}

export function joinRoom(roomId) {
  return api.post(`/api/rooms/${roomId}/join`);
}

export function leaveRoom(roomId) {
  return api.post(`/api/rooms/${roomId}/leave`);
}

export function closeRoom(roomId) {
  return api.delete(`/api/rooms/${roomId}`);
}
