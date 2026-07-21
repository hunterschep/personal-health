// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  safeInviteReturnTo: vi.fn((value: unknown): string | null =>
    typeof value === "string" ? value : null,
  ),
  setInviteReturnToCookie: vi.fn(),
  destroyCurrentSession: vi.fn(),
  clearActiveProfileCookie: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/auth/return-to", () => ({
  safeInviteReturnTo: mocks.safeInviteReturnTo,
  setInviteReturnToCookie: mocks.setInviteReturnToCookie,
}));
vi.mock("@/server/auth/session", () => ({
  destroyCurrentSession: mocks.destroyCurrentSession,
}));
vi.mock("@/server/authorization/active-profile", () => ({
  clearActiveProfileCookie: mocks.clearActiveProfileCookie,
}));

import { POST } from "./route";

const invitePath = "/invite/profile/abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("invite authentication handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the invite in a cookie and keeps it out of the registration URL", async () => {
    const form = new FormData();
    form.set("returnTo", invitePath);
    form.set("destination", "register");
    const response = await POST(
      new Request("http://localhost/api/auth/invite-return", { method: "POST", body: form }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL("/register", process.env.APP_BASE_URL ?? "http://localhost").href,
    );
    expect(response.headers.get("location")).not.toContain("invite");
    expect(mocks.setInviteReturnToCookie).toHaveBeenCalledWith(invitePath);
  });

  it("can clear the current session while preserving the invite handoff", async () => {
    const form = new FormData();
    form.set("returnTo", invitePath);
    form.set("destination", "switch-account");
    const response = await POST(
      new Request("http://localhost/api/auth/invite-return", { method: "POST", body: form }),
    );

    expect(response.status).toBe(303);
    expect(mocks.setInviteReturnToCookie).toHaveBeenCalledBefore(mocks.destroyCurrentSession);
    expect(mocks.clearActiveProfileCookie).toHaveBeenCalledTimes(1);
  });

  it("rejects external return targets", async () => {
    mocks.safeInviteReturnTo.mockReturnValueOnce(null);
    const form = new FormData();
    form.set("returnTo", "https://example.com/invite/profile/token");
    form.set("destination", "sign-in");
    const response = await POST(
      new Request("http://localhost/api/auth/invite-return", { method: "POST", body: form }),
    );

    expect(response.status).toBe(400);
    expect(mocks.setInviteReturnToCookie).not.toHaveBeenCalled();
  });
});
