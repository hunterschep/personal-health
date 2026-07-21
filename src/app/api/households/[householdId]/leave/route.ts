import { NextResponse } from "next/server";
import { ConflictError, NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { protectProfilesForMemberDeparture } from "@/server/households";
import { routeError } from "@/server/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { householdId } = await params;
    const { session, membership, household } = await requireHouseholdAccess(householdId, "view");
    if (membership.role === "owner") {
      throw new ConflictError("Transfer household ownership before leaving.");
    }
    const result = await prisma.$transaction(async (database) => {
      const removed = await database.householdMember.updateMany({
        where: { id: membership.id, removedAt: null },
        data: { removedAt: new Date() },
      });
      if (removed.count !== 1) throw new NotFoundError();
      const protectedData = await protectProfilesForMemberDeparture(
        database,
        household.id,
        session.user.id,
      );
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.member_left",
          entityType: "HouseholdMember",
          entityId: membership.id,
          metadataJson: protectedData,
        },
      });
      return protectedData;
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
