import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, ConflictError, RateLimitError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { verifyPassword } from "@/server/auth/password";
import {
  accountRateLimitKey,
  consumeLoginAttempt,
  networkRateLimitKey,
} from "@/server/auth/rate-limit";
import { destroyCurrentSession, requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";
import { deleteDocumentBlobs } from "@/server/storage";

const deleteSchema = z.object({
  password: z.string().min(1).max(256),
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const limits = [
      consumeLoginAttempt(accountRateLimitKey(session.user.id, "account-delete")),
      consumeLoginAttempt(networkRateLimitKey(request, "account-delete"), Date.now(), 10),
    ];
    if (limits.some(({ allowed }) => !allowed)) {
      throw new RateLimitError("Wait before trying the current password again.");
    }
    const input = deleteSchema.parse(Object.fromEntries((await request.formData()).entries()));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    if (user.passwordHash === null || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new AuthenticationError("The current password is incorrect.");
    }
    const ownedHouseholds = await prisma.household.findMany({
      where: { ownerUserId: user.id, deletedAt: null },
      include: {
        members: { where: { removedAt: null } },
        profiles: {
          where: { deletedAt: null, ownerUserId: { not: null } },
          select: { ownerUserId: true },
        },
      },
    });
    if (
      ownedHouseholds.some((household) =>
        household.members.some((member) => member.userId !== user.id),
      )
    ) {
      throw new ConflictError("Transfer household ownership before deleting this account.");
    }
    if (
      ownedHouseholds.some((household) =>
        household.profiles.some(
          (profile) => profile.ownerUserId !== null && profile.ownerUserId !== user.id,
        ),
      )
    ) {
      throw new ConflictError(
        "Transfer household ownership before deleting an account whose household contains another adult's claimed profile.",
      );
    }
    const profiles = await prisma.profile.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: user.id },
          { householdId: { in: ownedHouseholds.map(({ id }) => id) } },
        ],
      },
      select: { id: true },
    });
    const profileIds = profiles.map(({ id }) => id);
    const documents = await prisma.document.findMany({
      where: { profileId: { in: profileIds }, blobDeletedAt: null },
      select: { id: true, storageKey: true, householdId: true, profileId: true },
    });
    const deletedAt = new Date();
    const anonymizedEmail = `deleted-${randomUUID()}@deleted.invalid`;
    await prisma.$transaction(async (database) => {
      if (profileIds.length > 0) {
        await database.profile.updateMany({
          where: { id: { in: profileIds } },
          data: { deletedAt },
        });
        await database.document.updateMany({
          where: { profileId: { in: profileIds }, deletedAt: null },
          data: { deletedAt },
        });
        await database.reminder.updateMany({
          where: { profileId: { in: profileIds }, status: "pending" },
          data: { status: "cancelled" },
        });
      }
      if (ownedHouseholds.length > 0) {
        await database.household.updateMany({
          where: { id: { in: ownedHouseholds.map(({ id }) => id) } },
          data: { deletedAt },
        });
      }
      await database.householdMember.updateMany({
        where: { userId: user.id, removedAt: null },
        data: { removedAt: deletedAt },
      });
      await database.session.deleteMany({ where: { userId: user.id } });
      await database.user.update({
        where: { id: user.id },
        data: {
          email: anonymizedEmail,
          emailNormalized: anonymizedEmail,
          passwordHash: null,
          name: null,
          image: null,
          deletedAt,
          sessionVersion: { increment: 1 },
        },
      });
      await database.auditLog.create({
        data: {
          action: "account.deleted",
          entityType: "User",
          entityId: user.id,
          metadataJson: { profileCount: profileIds.length, documentCount: documents.length },
        },
      });
    });
    const cleanup = await deleteDocumentBlobs(documents);
    await destroyCurrentSession();
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, cleanupPending: cleanup.failedIds.length > 0 });
    }
    const destination = appUrl("/", request.url);
    destination.searchParams.set("accountDeleted", "1");
    if (cleanup.failedIds.length > 0) destination.searchParams.set("cleanupPending", "1");
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    return routeError(error);
  }
}
