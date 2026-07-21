// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  profileFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
}));

vi.mock("@/server/db/client", () => ({
  prisma: { profile: { findFirst: mocks.profileFindFirst } },
}));

import {
  activeProfileCookieName,
  chooseActiveProfileId,
  resolveActiveProfileId,
  setActiveProfileCookie,
} from "./active-profile";

const preferredId = "90000000-0000-4000-8000-000000000001";
const fallbackId = "90000000-0000-4000-8000-000000000002";

describe("active profile selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the selected profile only while it remains accessible", () => {
    expect(chooseActiveProfileId(preferredId, [fallbackId, preferredId])).toBe(preferredId);
    expect(chooseActiveProfileId(preferredId, [fallbackId])).toBe(fallbackId);
    expect(chooseActiveProfileId(preferredId, [])).toBeNull();
  });

  it("falls back safely when a selected profile was deleted or access was revoked", async () => {
    mocks.cookieGet.mockReturnValue({ value: preferredId });
    mocks.profileFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: fallbackId });

    await expect(resolveActiveProfileId("user-id")).resolves.toBe(fallbackId);
    expect(mocks.profileFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.profileFindFirst.mock.calls[0]?.[0].where.AND[0]).toEqual({ id: preferredId });
    expect(mocks.profileFindFirst.mock.calls[1]?.[0]).toMatchObject({
      orderBy: [{ createdAt: "asc" }, { displayName: "asc" }],
    });
  });

  it("writes a server-only selection cookie bounded by the session", async () => {
    const expiresAt = new Date("2026-08-21T12:00:00.000Z");
    await setActiveProfileCookie(preferredId, expiresAt);

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      activeProfileCookieName(),
      preferredId,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      }),
    );
  });
});
