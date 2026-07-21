// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireSession: vi.fn(),
  acceptProfileClaimInvitation: vi.fn(),
  setActiveProfileCookie: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/authorization/active-profile", () => ({
  setActiveProfileCookie: mocks.setActiveProfileCookie,
}));
vi.mock("@/server/invitations", () => ({
  acceptProfileClaimInvitation: mocks.acceptProfileClaimInvitation,
}));

import { POST } from "./route";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("profile claim body acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({
      user: { id: "user-id", email: "invited@example.com" },
      expiresAt: new Date("2026-08-21T12:00:00.000Z"),
    });
    mocks.acceptProfileClaimInvitation.mockResolvedValue({ id: "profile-id" });
  });

  it("keeps the raw token out of the acceptance URL and selects the claimed profile", async () => {
    const form = new FormData();
    form.set("token", token);
    const response = await POST(
      new Request("http://localhost/api/invitations/profile/accept", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL("/app/profile/profile-id/care-plan", process.env.APP_BASE_URL ?? "http://localhost")
        .href,
    );
    expect(response.url).not.toContain(token);
    expect(mocks.setActiveProfileCookie).toHaveBeenCalledWith(
      "profile-id",
      new Date("2026-08-21T12:00:00.000Z"),
    );
  });
});
