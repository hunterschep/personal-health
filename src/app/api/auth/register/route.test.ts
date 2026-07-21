// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  hashPassword: vi.fn(),
  createSession: vi.fn(),
  consumeLoginAttempt: vi.fn(),
  networkRateLimitKey: vi.fn(() => "network-key"),
  safeAppReturnTo: vi.fn(),
  setInviteReturnToCookie: vi.fn(),
  takeInviteReturnToCookie: vi.fn(),
  configuredIdentityMailer: vi.fn(),
  sendEmailVerification: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/server/auth/identity-email", () => ({
  configuredIdentityMailer: mocks.configuredIdentityMailer,
}));
vi.mock("@/server/auth/identity-flows", () => ({
  sendEmailVerification: mocks.sendEmailVerification,
}));
vi.mock("@/server/auth/session", () => ({ createSession: mocks.createSession }));
vi.mock("@/server/auth/rate-limit", () => ({
  consumeLoginAttempt: mocks.consumeLoginAttempt,
  networkRateLimitKey: mocks.networkRateLimitKey,
}));
vi.mock("@/server/auth/return-to", () => ({
  safeAppReturnTo: mocks.safeAppReturnTo,
  setInviteReturnToCookie: mocks.setInviteReturnToCookie,
  takeInviteReturnToCookie: mocks.takeInviteReturnToCookie,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst, create: mocks.userCreate },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { POST } from "./route";

const invitePath = "/invite/profile/abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("registration invite continuation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeLoginAttempt.mockReturnValue({ allowed: true });
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.hashPassword.mockResolvedValue("password-hash");
    mocks.userCreate.mockResolvedValue({ id: "user-id" });
    mocks.auditCreate.mockResolvedValue({ id: "audit-id" });
    mocks.safeAppReturnTo.mockReturnValue(null);
    mocks.takeInviteReturnToCookie.mockResolvedValue(invitePath);
    mocks.configuredIdentityMailer.mockReturnValue(null);
    mocks.sendEmailVerification.mockResolvedValue("sent");
  });

  it("returns a new account to the invite instead of forcing onboarding", async () => {
    const form = new FormData();
    form.set("name", "Invited Adult");
    form.set("email", "invited@example.com");
    form.set("password", "correct horse battery staple");
    form.set("passwordConfirmation", "correct horse battery staple");
    form.set("acknowledged", "true");
    const response = await POST(
      new Request("http://localhost/api/auth/register", { method: "POST", body: form }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL(invitePath, process.env.APP_BASE_URL ?? "http://localhost").href,
    );
    expect(mocks.createSession).toHaveBeenCalledWith("user-id");
    expect(mocks.takeInviteReturnToCookie).toHaveBeenCalledTimes(1);
  });

  it("requires SMTP email confirmation while preserving an invitation return path", async () => {
    const identityMailer = {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    };
    mocks.configuredIdentityMailer.mockReturnValue(identityMailer);
    const form = new FormData();
    form.set("name", "Invited Adult");
    form.set("email", "invited@example.com");
    form.set("password", "correct horse battery staple");
    form.set("passwordConfirmation", "correct horse battery staple");
    form.set("acknowledged", "true");

    const response = await POST(
      new Request("http://localhost/api/auth/register", { method: "POST", body: form }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL("/verify-email?pending=1", process.env.APP_BASE_URL ?? "http://localhost").href,
    );
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ emailVerified: null }),
    });
    expect(mocks.setInviteReturnToCookie).toHaveBeenCalledWith(invitePath);
    expect(mocks.sendEmailVerification).toHaveBeenCalledWith("user-id", identityMailer);
  });
});
