// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  signInWithAuthJs: vi.fn(),
  consumeLoginAttempt: vi.fn(),
  clearLoginAttempts: vi.fn(),
  loginRateLimitKey: vi.fn(() => "login-key"),
  networkRateLimitKey: vi.fn(() => "network-key"),
  destroyCurrentSession: vi.fn(),
  safeAppReturnTo: vi.fn(),
  takeInviteReturnToCookie: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/auth", () => ({ signInWithAuthJs: mocks.signInWithAuthJs }));
vi.mock("@/server/auth/rate-limit", () => ({
  consumeLoginAttempt: mocks.consumeLoginAttempt,
  clearLoginAttempts: mocks.clearLoginAttempts,
  loginRateLimitKey: mocks.loginRateLimitKey,
  networkRateLimitKey: mocks.networkRateLimitKey,
}));
vi.mock("@/server/auth/session", () => ({ destroyCurrentSession: mocks.destroyCurrentSession }));
vi.mock("@/server/auth/return-to", () => ({
  safeAppReturnTo: mocks.safeAppReturnTo,
  takeInviteReturnToCookie: mocks.takeInviteReturnToCookie,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

const invitePath = "/invite/household/abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("sign-in invite continuation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeLoginAttempt.mockReturnValue({ allowed: true });
    mocks.signInWithAuthJs.mockResolvedValue("http://localhost/app");
    mocks.userFindFirst.mockResolvedValue({ id: "user-id" });
    mocks.userUpdate.mockReturnValue(Promise.resolve({ id: "user-id" }));
    mocks.auditCreate.mockReturnValue(Promise.resolve({ id: "audit-id" }));
    mocks.transaction.mockResolvedValue([]);
    mocks.safeAppReturnTo.mockReturnValue(null);
    mocks.takeInviteReturnToCookie.mockResolvedValue(invitePath);
  });

  it("returns to the invite without putting the token on the sign-in URL", async () => {
    const form = new FormData();
    form.set("email", "invited@example.com");
    form.set("password", "correct horse battery staple");
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in", { method: "POST", body: form }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL(invitePath, process.env.APP_BASE_URL ?? "http://localhost").href,
    );
    expect(mocks.signInWithAuthJs).toHaveBeenCalledWith("credentials", {
      email: "invited@example.com",
      password: "correct horse battery staple",
      redirect: false,
      redirectTo: "/app",
    });
    expect(mocks.takeInviteReturnToCookie).toHaveBeenCalledTimes(1);
  });
});
