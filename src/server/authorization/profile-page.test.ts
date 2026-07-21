import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError, NotFoundError } from "@/domain/shared/errors";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((): never => {
    throw new Error("NEXT_REDIRECT");
  }),
  requireProfileAccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));

import { requireProfilePageAccess } from "./profile-page";

describe("profile page authorization adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns authorized profile context", async () => {
    const context = { profile: { id: "profile-1" } };
    mocks.requireProfileAccess.mockResolvedValue(context);

    await expect(requireProfilePageAccess("profile-1", "edit")).resolves.toBe(context);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-1", "edit");
  });

  it("uses the neutral not-found page for missing or unauthorized profiles", async () => {
    mocks.requireProfileAccess.mockRejectedValue(new NotFoundError());

    await expect(requireProfilePageAccess("private-profile")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects an expired session to sign-in", async () => {
    mocks.requireProfileAccess.mockRejectedValue(new AuthenticationError());

    await expect(requireProfilePageAccess("profile-1")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?reason=session-required");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("does not hide unexpected failures", async () => {
    const failure = new Error("database unavailable");
    mocks.requireProfileAccess.mockRejectedValue(failure);

    await expect(requireProfilePageAccess("profile-1")).rejects.toBe(failure);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
