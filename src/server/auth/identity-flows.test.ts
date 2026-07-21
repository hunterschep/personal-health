import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  consumeIdentityToken: vi.fn(),
  issueIdentityToken: vi.fn(),
  hashPassword: vi.fn(),
  userUpdateMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
  transactionAuditCreate: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./identity-tokens", () => ({
  consumeIdentityToken: mocks.consumeIdentityToken,
  issueIdentityToken: mocks.issueIdentityToken,
}));
vi.mock("./password", () => ({ hashPassword: mocks.hashPassword }));

import {
  completePasswordReset,
  confirmEmailVerification,
  sendEmailVerification,
  sendPasswordReset,
} from "./identity-flows";

const mailer = {
  sendEmailVerification: vi.fn(),
  sendPasswordReset: vi.fn(),
};

describe("email identity flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.issueIdentityToken.mockResolvedValue("raw-token");
    mocks.hashPassword.mockResolvedValue("argon-hash");
    mocks.auditCreate.mockResolvedValue({});
    mailer.sendEmailVerification.mockResolvedValue(undefined);
    mailer.sendPasswordReset.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (database: unknown) => unknown) =>
      callback({
        user: { updateMany: mocks.userUpdateMany },
        session: { deleteMany: mocks.sessionDeleteMany },
        auditLog: { create: mocks.transactionAuditCreate },
        verificationToken: {},
      }),
    );
  });

  it("sends verification only for an unverified live account", async () => {
    mocks.userFindFirst.mockResolvedValue({
      email: "adult@example.test",
      emailVerified: null,
    });

    await expect(sendEmailVerification("user-id", mailer)).resolves.toBe("sent");
    expect(mocks.issueIdentityToken).toHaveBeenCalledWith("user-id", "email-verification");
    expect(mailer.sendEmailVerification).toHaveBeenCalledWith("adult@example.test", "raw-token");
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadataJson: {} }) }),
    );
  });

  it("keeps password reset requests neutral when no account matches", async () => {
    mocks.userFindFirst.mockResolvedValue(null);

    await expect(sendPasswordReset("missing@example.test", mailer)).resolves.toBeUndefined();
    expect(mocks.issueIdentityToken).not.toHaveBeenCalled();
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("marks a verified account inside the token-consumption transaction", async () => {
    mocks.consumeIdentityToken.mockResolvedValue("user-id");
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });

    await expect(confirmEmailVerification("raw-token")).resolves.toBe("user-id");
    expect(mocks.consumeIdentityToken).toHaveBeenCalledWith(
      expect.any(Object),
      "raw-token",
      "email-verification",
    );
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { emailVerified: expect.any(Date) } }),
    );
  });

  it("rotates all sessions after a single-use password reset", async () => {
    mocks.consumeIdentityToken.mockResolvedValue("user-id");
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 2 });

    await expect(completePasswordReset("raw-token", "new secure password")).resolves.toBe(true);
    expect(mocks.hashPassword).toHaveBeenCalledWith("new secure password");
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-id", deletedAt: null },
      data: { passwordHash: "argon-hash", sessionVersion: { increment: 1 } },
    });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-id" } });
  });
});
