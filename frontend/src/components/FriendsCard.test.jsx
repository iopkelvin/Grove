// This card was hard-coded to "0 Friends Online".

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeUserContext, renderWithProviders } from "../test/helpers";

const mockUser = vi.fn();
vi.mock("../context/UserContext", () => ({ useUser: () => mockUser() }));

const { default: FriendsCard } = await import("./FriendsCard");

describe("FriendsCard", () => {
  it("shows how many friends are online", () => {
    mockUser.mockReturnValue(
      makeUserContext({ friendsSummary: { total: 5, online: 2, pending_incoming: 0 } })
    );

    renderWithProviders(<FriendsCard />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/of 5 online/)).toBeInTheDocument();
  });

  it("invites you to find someone when you have no friends", () => {
    mockUser.mockReturnValue(
      makeUserContext({ friendsSummary: { total: 0, online: 0, pending_incoming: 0 } })
    );

    renderWithProviders(<FriendsCard />);

    expect(screen.getByRole("link", { name: /find someone/i })).toBeInTheDocument();
  });

  it("surfaces waiting requests", () => {
    mockUser.mockReturnValue(
      makeUserContext({ friendsSummary: { total: 3, online: 1, pending_incoming: 2 } })
    );

    renderWithProviders(<FriendsCard />);

    expect(screen.getByText(/2 requests waiting/)).toBeInTheDocument();
  });

  it("uses the singular for one request", () => {
    mockUser.mockReturnValue(
      makeUserContext({ friendsSummary: { total: 3, online: 1, pending_incoming: 1 } })
    );

    renderWithProviders(<FriendsCard />);

    expect(screen.getByText(/1 request waiting/)).toBeInTheDocument();
  });

  it("says nothing about requests when there are none", () => {
    mockUser.mockReturnValue(
      makeUserContext({ friendsSummary: { total: 3, online: 1, pending_incoming: 0 } })
    );

    renderWithProviders(<FriendsCard />);

    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });
});
