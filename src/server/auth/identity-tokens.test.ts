import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    $transaction: mocks.transaction,
    verificationToken: {
      deleteMany: mocks.deleteMany,
      create: mocks.create,
    },
  },
}));

import { hashOpaqueToken } from "./tokens";
import { consumeIdentityToken, issueIdentityToken } from "./identity-tokens";

describe("identity tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.create.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
  });

  it("stores only a hash and replaces older purpose-specific tokens", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));

    const raw = await issueIdentityToken("user-id", "password-reset");

    expect(raw).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "password-reset:user-id" },
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        identifier: "password-reset:user-id",
        token: hashOpaqueToken(raw),
        expires: new Date("2026-07-21T13:00:00.000Z"),
      },
    });
  });

  it("consumes a valid token exactly once for its intended purpose", async () => {
    const raw = "safe-single-use-token";
    const stored = {
      identifier: "email-verification:user-id",
      token: hashOpaqueToken(raw),
      expires: new Date(Date.now() + 60_000),
    };
    const database = {
      verificationToken: {
        findUnique: vi.fn().mockResolvedValue(stored),
        delete: vi.fn().mockResolvedValue(stored),
      },
    };

    await expect(consumeIdentityToken(database as never, raw, "email-verification")).resolves.toBe(
      "user-id",
    );
    expect(database.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: { identifier: stored.identifier, token: stored.token },
      },
    });
  });

  it("rejects expired and cross-purpose tokens without deleting them", async () => {
    const raw = "expired-or-wrong-purpose";
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        identifier: "password-reset:user-id",
        token: hashOpaqueToken(raw),
        expires: new Date(Date.now() - 1),
      })
      .mockResolvedValueOnce({
        identifier: "password-reset:user-id",
        token: hashOpaqueToken(raw),
        expires: new Date(Date.now() + 60_000),
      });
    const remove = vi.fn();
    const database = { verificationToken: { findUnique, delete: remove } };

    await expect(
      consumeIdentityToken(database as never, raw, "password-reset"),
    ).resolves.toBeNull();
    await expect(
      consumeIdentityToken(database as never, raw, "email-verification"),
    ).resolves.toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});
