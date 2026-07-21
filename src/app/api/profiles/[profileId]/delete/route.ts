import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";
import { deleteDocumentBlobs } from "@/server/storage";

const schema = z.object({ confirmation: z.string().trim().min(1).max(80) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "delete");
    const input = schema.parse(Object.fromEntries((await request.formData()).entries()));
    if (input.confirmation !== profile.displayName) {
      throw new ValidationError("Type the profile display name exactly to confirm deletion.");
    }
    const documents = await prisma.document.findMany({
      where: { profileId: profile.id, blobDeletedAt: null },
      select: { id: true, storageKey: true, householdId: true, profileId: true },
    });
    const deletedAt = new Date();
    await prisma.$transaction(async (database) => {
      await database.profile.update({ where: { id: profile.id }, data: { deletedAt } });
      const reminders = await database.reminder.updateMany({
        where: { profileId: profile.id, status: "pending" },
        data: { status: "cancelled" },
      });
      await database.document.updateMany({
        where: { profileId: profile.id, deletedAt: null },
        data: { deletedAt },
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "profile.deleted",
          entityType: "Profile",
          entityId: profile.id,
          metadataJson: { documentCount: documents.length, reminderCount: reminders.count },
        },
      });
    });
    const cleanup = await deleteDocumentBlobs(documents);
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, cleanupPending: cleanup.failedIds.length > 0 });
    }
    const destination = appUrl("/app/family", request.url);
    destination.searchParams.set("profileDeleted", "1");
    if (cleanup.failedIds.length > 0) destination.searchParams.set("cleanupPending", "1");
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    return routeError(error);
  }
}
