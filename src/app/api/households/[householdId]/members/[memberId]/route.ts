import { NextResponse } from "next/server";
import { z } from "zod";
import { ConflictError, NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { protectProfilesForMemberDeparture } from "@/server/households";
import { routeError } from "@/server/http";

type Context = { params: Promise<{ householdId: string; memberId: string }> };
const roleSchema = z.object({ role: z.enum(["admin", "member"]) });

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { householdId, memberId } = await params;
    const { session, household } = await requireHouseholdAccess(householdId, "owner");
    const input = roleSchema.parse(await request.json());
    const target = await prisma.householdMember.findFirst({
      where: { id: memberId, householdId: household.id, removedAt: null },
    });
    if (target === null) throw new NotFoundError();
    if (target.role === "owner") {
      throw new ConflictError("Transfer ownership before changing the owner’s role.");
    }
    await prisma.$transaction(async (database) => {
      await database.householdMember.update({
        where: { id: target.id },
        data: { role: input.role },
      });
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.member_role_updated",
          entityType: "HouseholdMember",
          entityId: target.id,
          metadataJson: { role: input.role },
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { householdId, memberId } = await params;
    const { session, household } = await requireHouseholdAccess(householdId, "manage");
    const target = await prisma.householdMember.findFirst({
      where: { id: memberId, householdId: household.id, removedAt: null },
    });
    if (target === null) throw new NotFoundError();
    if (target.role === "owner") {
      throw new ConflictError("Transfer ownership before removing the household owner.");
    }
    if (target.userId === session.user.id) {
      throw new ConflictError("Use the leave-household action to remove yourself.");
    }
    const result = await prisma.$transaction(async (database) => {
      const removed = await database.householdMember.updateMany({
        where: { id: target.id, removedAt: null },
        data: { removedAt: new Date() },
      });
      if (removed.count !== 1) throw new NotFoundError();
      const protectedData = await protectProfilesForMemberDeparture(
        database,
        household.id,
        target.userId,
      );
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.member_removed",
          entityType: "HouseholdMember",
          entityId: target.id,
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
