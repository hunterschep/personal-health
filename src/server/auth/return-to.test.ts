// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set }) }));

import {
  inviteReturnToCookieName,
  safeAppReturnTo,
  safeInviteReturnTo,
  setInviteReturnToCookie,
  takeInviteReturnToCookie,
} from "./return-to";

const invitePath = "/invite/profile/abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("authentication return paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts only local app and exact invite paths", () => {
    expect(safeAppReturnTo("/app/profile/123")).toBe("/app/profile/123");
    expect(safeAppReturnTo("//example.com/app")).toBeNull();
    expect(safeAppReturnTo("/application")).toBeNull();
    expect(safeInviteReturnTo(invitePath)).toBe(invitePath);
    expect(safeInviteReturnTo("/invite/profile/short")).toBeNull();
    expect(safeInviteReturnTo("https://example.com/invite/profile/token")).toBeNull();
  });

  it("stores invite continuation in an HttpOnly short-lived cookie", async () => {
    await setInviteReturnToCookie(invitePath);

    expect(mocks.set).toHaveBeenCalledWith(
      inviteReturnToCookieName(),
      invitePath,
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" }),
    );
  });

  it("consumes and clears the invite continuation", async () => {
    mocks.get.mockReturnValue({ value: invitePath });

    await expect(takeInviteReturnToCookie()).resolves.toBe(invitePath);
    expect(mocks.set).toHaveBeenLastCalledWith(
      inviteReturnToCookieName(),
      "",
      expect.objectContaining({ expires: new Date(0) }),
    );
  });
});
