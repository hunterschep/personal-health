import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(80),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { householdId } = await params;
    const { session, household } = await requireHouseholdAccess(householdId, "manage");
    const input = schema.parse(await request.json());
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format();
    } catch {
      throw new ValidationError("Choose a valid IANA timezone.");
    }
    const updated = await prisma.$transaction(async (database) => {
      const result = await database.household.update({ where: { id: household.id }, data: input });
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.updated",
          entityType: "Household",
          entityId: household.id,
          metadataJson: { timezoneChanged: household.timezone !== input.timezone },
        },
      });
      return result;
    });
    return NextResponse.json({ ok: true, household: updated });
  } catch (error) {
    return routeError(error);
  }
}
