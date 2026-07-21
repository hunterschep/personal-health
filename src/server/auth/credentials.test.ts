import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: { user: { findFirst: mocks.findFirst } },
}));
vi.mock("./password", () => ({ verifyPassword: mocks.verifyPassword }));

import { authenticateCredentials } from "./credentials";

describe("Auth.js credential authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the public identity after Argon2 verification", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "user-id",
      email: "adult@example.com",
      name: "Adult",
      passwordHash: "stored-hash",
    });
    mocks.verifyPassword.mockResolvedValue(true);

    await expect(
      authenticateCredentials({ email: " ADULT@example.com ", password: "valid password" }),
    ).resolves.toEqual({ id: "user-id", email: "adult@example.com", name: "Adult" });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("stored-hash", "valid password");
  });

  it("performs an equivalent Argon2 check when the account is unknown", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(
      authenticateCredentials({ email: "missing@example.com", password: "attempted password" }),
    ).resolves.toBeNull();
    expect(mocks.verifyPassword).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      "attempted password",
    );
  });

  it("rejects malformed credentials before database access", async () => {
    await expect(authenticateCredentials({ email: "invalid", password: "" })).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });
});
