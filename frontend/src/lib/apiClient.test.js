// The API client is the one place every request passes through, so it is
// the one place worth testing exhaustively.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse } from "../test/helpers";

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "test-token" } } })),
    },
  },
}));

const { supabase } = await import("./supabaseClient");
const { ApiError, api, messageFor, request } = await import("./apiClient");

describe("request", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
  });

  it("returns the parsed body on success", async () => {
    global.fetch.mockResolvedValue(jsonResponse({ id: 1, title: "Read" }));

    await expect(request("/api/tasks/1")).resolves.toEqual({ id: 1, title: "Read" });
  });

  it("attaches the Supabase access token", async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));

    await request("/api/tasks");

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-token");
  });

  it("omits the header when nobody is signed in", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    global.fetch.mockResolvedValue(jsonResponse({}));

    await request("/api/users/by-username/kelvin");

    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("skips auth entirely when asked", async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));

    await request("/api/health", { auth: false });

    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it("drops empty query parameters instead of sending them blank", async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));

    await request("/api/tasks", { params: { tag: "college", q: "", limit: undefined } });

    expect(global.fetch.mock.calls[0][0]).toBe("/api/tasks?tag=college");
  });

  it("returns null for 204 rather than trying to parse a body", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => {
        throw new Error("should not be called");
      },
      text: async () => "",
    });

    await expect(api.delete("/api/tasks/1")).resolves.toBeNull();
  });
});

describe("error handling", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
  });

  it("throws ApiError carrying the status and code", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ error: "Task not found.", code: "not_found" }, { status: 404 })
    );

    await expect(request("/api/tasks/9")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "not_found",
      message: "Task not found.",
    });
  });

  it("surfaces per-field validation messages", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(
        {
          error: "Some fields are invalid.",
          code: "validation_error",
          details: { fields: { title: "This field is required." } },
        },
        { status: 400 }
      )
    );

    try {
      await request("/api/tasks", { method: "POST", body: {} });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error.isValidationError).toBe(true);
      expect(error.fields.title).toBe("This field is required.");
    }
  });

  it("flags 401 so the UI can send the user back to login", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ error: "Sign in to continue.", code: "unauthorized" }, { status: 401 })
    );

    await expect(request("/api/users/me")).rejects.toSatisfy((error) => error.isAuthError);
  });

  it("keeps the request id so a bug report is traceable", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(
        { error: "Boom", code: "internal_error" },
        { status: 500, headers: { "x-request-id": "abc123" } }
      )
    );

    await expect(request("/api/tasks")).rejects.toMatchObject({ requestId: "abc123" });
  });

  it("turns a network failure into a readable message, not a TypeError", async () => {
    global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await request("/api/tasks");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error.isNetworkError).toBe(true);
      expect(error.message).toMatch(/could not reach the server/i);
    }
  });

  it("times out rather than spinning forever", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch.mockRejectedValue(abortError);

    await expect(request("/api/tasks", { timeoutMs: 1 })).rejects.toMatchObject({
      code: "network_error",
    });
  });

  it("does not choke on an HTML error page", async () => {
    // The backend should never do this any more, but a proxy or CDN in
    // front of it still can.
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => "text/html" },
      text: async () => "<html>Bad Gateway</html>",
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });

    await expect(request("/api/tasks")).rejects.toMatchObject({ status: 502 });
  });
});

describe("messageFor", () => {
  it("uses the server's wording for an ApiError", () => {
    expect(messageFor(new ApiError("That room is full."))).toBe("That room is full.");
  });

  it("falls back for anything else", () => {
    // Without this, the UI would print "Cannot read properties of
    // undefined" at the user.
    expect(messageFor(new TypeError("x is undefined"))).toMatch(/something went wrong/i);
  });

  it("accepts a caller-supplied fallback", () => {
    expect(messageFor(null, "Could not add that task.")).toBe("Could not add that task.");
  });
});
