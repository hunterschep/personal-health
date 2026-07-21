import { NextResponse } from "next/server";
import { z } from "zod";
import { NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const schema = z.object({ userId: z.uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { householdId } = await params;
    const { session, membership, household } = await requireHouseholdAccess(householdId, "owner");
    const input = schema.parse(await request.json());
    const target = await prisma.householdMember.findFirst({
      where: { householdId: household.id, userId: input.userId, removedAt: null },
    });
    if (target === null || target.userId === session.user.id) throw new NotFoundError();
    await prisma.$transaction(async (database) => {
      await database.household.update({
        where: { id: household.id },
        data: { ownerUserId: target.userId },
      });
      await database.householdMember.update({
        where: { id: membership.id },
        data: { role: "admin" },
      });
      await database.householdMember.update({ where: { id: target.id }, data: { role: "owner" } });
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.ownership_transferred",
          entityType: "Household",
          entityId: household.id,
          metadataJson: {},
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
