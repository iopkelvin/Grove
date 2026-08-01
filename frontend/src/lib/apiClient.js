// Central API client.
//
// Every module used to call fetch itself and swallow whatever came back:
//
//     const res = await fetch(`${API_URL}/api/tasks?${params}`);
//     return res.ok ? res.json() : [];
//
// Three problems with that. A server error and an empty task list became the
// same value, so the UI showed "Nothing here yet — add your first task" when
// the backend was down. Nothing sent an Authorization header, because
// identity travelled as a query parameter. And VITE_API_URL being unset
// produced requests to the literal URL "undefined/api/tasks".
//
// This module is the only place that talks to the network. It attaches the
// Supabase access token, times out, and turns failures into a typed error
// the UI can actually render.

import { supabase } from "./supabaseClient";

// Empty base URL is the correct default, not a missing one: requests then go
// to the Vite dev server's /api proxy (vite.config.js), which forwards to
// Flask and sidesteps CORS entirely. Production sets VITE_API_URL to the
// deployed API origin.
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * A failed request, with everything the UI needs to respond to it.
 *
 * `fields` carries the backend's per-field validation messages so a form can
 * put each one next to the input that caused it, instead of showing one
 * generic banner at the top.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "unknown", fields = null, requestId = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }

  /** The session is gone or invalid — send the user back to the login page. */
  get isAuthError() {
    return this.status === 401;
  }

  /** Nothing reached the server: offline, DNS, CORS, or a timeout. */
  get isNetworkError() {
    return this.status === 0;
  }

  get isValidationError() {
    return this.status === 400 && Boolean(this.fields);
  }
}

async function authHeader() {
  // supabase-js caches the session in memory and only hits the network when
  // the token needs refreshing, so this is cheap to call per request.
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // A broken auth client must not stop unauthenticated reads (public
    // profiles) from working.
    return {};
  }
}

async function parseBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return text || null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorFromResponse(response, body) {
  const isObject = body && typeof body === "object";
  return new ApiError(isObject && body.error ? body.error : `Request failed (${response.status})`, {
    status: response.status,
    code: isObject && body.code ? body.code : "http_error",
    fields: isObject && body.details?.fields ? body.details.fields : null,
    requestId: response.headers.get("X-Request-ID"),
  });
}

/**
 * Make a request. Resolves with the parsed body, or throws ApiError.
 *
 * @param {string} path      e.g. "/api/tasks"
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]    serialised as JSON
 * @param {object} [options.params]  query string; null/undefined values are dropped
 * @param {boolean} [options.auth]   attach the bearer token (default true)
 * @param {AbortSignal} [options.signal]
 */
export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    params,
    auth = true,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") search.set(key, value);
    }
    const query = search.toString();
    if (query) url += `?${query}`;
  }

  const headers = { ...(body !== undefined ? { "Content-Type": "application/json" } : {}) };
  if (auth) Object.assign(headers, await authHeader());

  // A request with no timeout hangs forever on a sleeping backend — Render's
  // free tier suspends after inactivity and the first call has to wake it —
  // and the user sees a spinner that never resolves.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    if (cause?.name === "AbortError" && signal?.aborted) {
      throw cause; // the caller cancelled deliberately; not an error to show
    }
    throw new ApiError(
      cause?.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Could not reach the server. Check your connection and try again.",
      { status: 0, code: "network_error" }
    );
  } finally {
    clearTimeout(timeout);
  }

  const parsed = await parseBody(response);
  if (!response.ok) throw errorFromResponse(response, parsed);
  return parsed;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

/**
 * Turn any thrown value into a sentence worth showing a user.
 *
 * Components call this instead of interpolating `err.message`, which for a
 * non-ApiError is often something like "Cannot read properties of undefined".
 */
export function messageFor(error, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
