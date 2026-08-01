import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { makeUserContext, renderWithProviders } from "../test/helpers";

const mockUser = vi.fn();
vi.mock("../context/UserContext", () => ({ useUser: () => mockUser() }));
vi.mock("../api/rooms", () => ({
  getLobby: vi.fn(),
  joinLobby: vi.fn(),
  leaveLobby: vi.fn(),
}));

const roomsApi = await import("../api/rooms");
const { default: Lobby } = await import("./Lobby");

const member = (id, username) => ({
  id,
  username,
  display_name: username,
  avatar_url: null,
  is_online: true,
  current_streak: id,
});

const lobby = (overrides = {}) => ({
  joined: false,
  online_window_seconds: 300,
  room: {
    id: 1,
    name: "The Grove",
    is_global: true,
    theme: "grove",
    capacity: null,
    population: 2,
    is_full: false,
    members: [member(1, "kelvin"), member(2, "kyle")],
    host_id: null,
    host_username: null,
    ...overrides.room,
  },
  ...overrides,
});

describe("Lobby page", () => {
  beforeEach(() => {
    mockUser.mockReturnValue(makeUserContext());
    roomsApi.getLobby.mockResolvedValue(lobby());
  });

  it("shows the population", async () => {
    renderWithProviders(<Lobby />);

    expect(await screen.findByText(/people are/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("uses the singular for one person", async () => {
    roomsApi.getLobby.mockResolvedValue(
      lobby({ room: { population: 1, members: [member(1, "kelvin")] } })
    );
    renderWithProviders(<Lobby />);

    expect(await screen.findByText(/person is/)).toBeInTheDocument();
  });

  it("lists who is there", async () => {
    renderWithProviders(<Lobby />);

    expect(await screen.findByRole("link", { name: "kelvin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "kyle" })).toBeInTheDocument();
  });

  it("offers to join when you are not in it", async () => {
    renderWithProviders(<Lobby />);

    expect(await screen.findByRole("button", { name: /join the grove/i })).toBeInTheDocument();
  });

  it("joins", async () => {
    roomsApi.joinLobby.mockResolvedValue(lobby({ joined: true }));
    renderWithProviders(<Lobby />);

    await userEvent.click(await screen.findByRole("button", { name: /join the grove/i }));

    expect(roomsApi.joinLobby).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /leave/i })).toBeInTheDocument();
  });

  it("reports a failed join instead of silently doing nothing", async () => {
    roomsApi.joinLobby.mockRejectedValue(new ApiError("That room is full.", { status: 409 }));
    renderWithProviders(<Lobby />);

    await userEvent.click(await screen.findByRole("button", { name: /join the grove/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That room is full.");
  });

  it("invites the first person in when it is empty", async () => {
    roomsApi.getLobby.mockResolvedValue(lobby({ room: { population: 0, members: [] } }));
    renderWithProviders(<Lobby />);

    expect(await screen.findByText(/nobody yet/i)).toBeInTheDocument();
  });

  it("shows an error state if the room cannot be loaded at all", async () => {
    roomsApi.getLobby.mockRejectedValue(new ApiError("Down", { status: 503 }));
    renderWithProviders(<Lobby />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Down");
  });

  it("keeps the room on screen when a background refresh fails", async () => {
    // Polling every 30s must not be able to replace a working page with an
    // error screen because of one blip.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<Lobby />);
    await screen.findByRole("link", { name: "kelvin" });

    roomsApi.getLobby.mockRejectedValue(new ApiError("Blip", { status: 503 }));
    await vi.advanceTimersByTimeAsync(31000);

    await waitFor(() => expect(screen.getByRole("link", { name: "kelvin" })).toBeInTheDocument());
    vi.useRealTimers();
  });
});
