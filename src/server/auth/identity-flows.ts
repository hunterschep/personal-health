import type { IdentityMailer } from "@/server/auth/identity-email";
import { capabilitiesFromEnvironment } from "@/config/capabilities";
import { getServerEnv } from "@/config/env";
import { ConflictError } from "@/domain/shared/errors";
import { prisma } from "@/server/db/client";

import { consumeIdentityToken, issueIdentityToken } from "./identity-tokens";
import { hashPassword } from "./password";

export async function requireVerifiedEmailForInvitation(userId: string): Promise<void> {
  if (!capabilitiesFromEnvironment(getServerEnv()).smtpConfigured) return;
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { emailVerified: true },
  });
  if (user?.emailVerified === null || user === null) {
    throw new ConflictError("Confirm this account's email before accepting the invitation.");
  }
}

export async function sendEmailVerification(
  userId: string,
  mailer: IdentityMailer,
): Promise<"already-verified" | "sent"> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { email: true, emailVerified: true },
  });
  if (user === null) throw new Error("Account is not available.");
  if (user.emailVerified !== null) return "already-verified";

  const token = await issueIdentityToken(userId, "email-verification");
  await mailer.sendEmailVerification(user.email, token);
  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: "account.email_verification_sent",
      entityType: "User",
      entityId: userId,
      metadataJson: {},
    },
  });
  return "sent";
}

export async function confirmEmailVerification(rawToken: string): Promise<string | null> {
  return prisma.$transaction(async (database) => {
    const userId = await consumeIdentityToken(database, rawToken, "email-verification");
    if (userId === null) return null;
    const updated = await database.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: { emailVerified: new Date() },
    });
    if (updated.count !== 1) return null;
    await database.auditLog.create({
      data: {
        actorUserId: userId,
        action: "account.email_verified",
        entityType: "User",
        entityId: userId,
        metadataJson: {},
      },
    });
    return userId;
  });
}

export async function sendPasswordReset(
  emailNormalized: string,
  mailer: IdentityMailer,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { emailNormalized, deletedAt: null, passwordHash: { not: null } },
    select: { id: true, email: true },
  });
  if (user === null) return;

  const token = await issueIdentityToken(user.id, "password-reset");
  await mailer.sendPasswordReset(user.email, token);
  await prisma.auditLog.create({
    data: {
      action: "account.password_reset_sent",
      entityType: "User",
      entityId: user.id,
      metadataJson: {},
    },
  });
}

export async function completePasswordReset(
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async (database) => {
    const userId = await consumeIdentityToken(database, rawToken, "password-reset");
    if (userId === null) return false;
    const updated = await database.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (updated.count !== 1) return false;
    await database.session.deleteMany({ where: { userId } });
    await database.auditLog.create({
      data: {
        actorUserId: userId,
        action: "account.password_reset_completed",
        entityType: "User",
        entityId: userId,
        metadataJson: {},
      },
    });
    return true;
  });
}
