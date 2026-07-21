import { NextResponse } from "next/server";
import { NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ householdId: string; inviteId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { householdId, inviteId } = await params;
    const { session, household } = await requireHouseholdAccess(householdId, "manage");
    await prisma.$transaction(async (database) => {
      const result = await database.householdInvite.updateMany({
        where: {
          id: inviteId,
          householdId: household.id,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) throw new NotFoundError();
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.invite_revoked",
          entityType: "HouseholdInvite",
          entityId: inviteId,
          metadataJson: {},
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
