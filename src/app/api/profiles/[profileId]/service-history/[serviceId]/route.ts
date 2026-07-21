import { NextResponse } from "next/server";
import { z } from "zod";

import { NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { rebuildRecommendations } from "@/server/recommendations";

const responseSchema = z.object({
  state: z.enum(["declined", "not_applicable_claim"]),
  reason: z.string().trim().min(1, "Add a brief explanation.").max(500),
});

type RouteContext = {
  params: Promise<{ profileId: string; serviceId: string }>;
};

async function requireCurrentService(profileId: string, serviceId: string) {
  const recommendation = await prisma.recommendationInstance.findFirst({
    where: { profileId, serviceId, retiredAt: null },
    select: { serviceId: true },
  });
  if (recommendation === null) throw new NotFoundError("This care-plan item is not available.");
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId, serviceId } = await params;
    const input = responseSchema.parse(await request.json());
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    await requireCurrentService(profile.id, serviceId);

    await prisma.$transaction(async (database) => {
      const response = await database.profileServiceHistoryState.upsert({
        where: { profileId_serviceId: { profileId: profile.id, serviceId } },
        create: {
          profileId: profile.id,
          serviceId,
          state: input.state,
          reason: input.reason,
          recordedAt: new Date(),
          recordedByUserId: session.user.id,
        },
        update: {
          state: input.state,
          reason: input.reason,
          recordedAt: new Date(),
          recordedByUserId: session.user.id,
        },
      });
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_edited",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_plan.personal_response_recorded",
          entityType: "ProfileServiceHistoryState",
          entityId: response.id,
          metadataJson: {},
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId, serviceId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    await requireCurrentService(profile.id, serviceId);

    await prisma.$transaction(async (database) => {
      const removed = await database.profileServiceHistoryState.deleteMany({
        where: {
          profileId: profile.id,
          serviceId,
          state: { in: ["declined", "not_applicable_claim"] },
        },
      });
      if (removed.count === 0) return;
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_edited",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_plan.personal_response_cleared",
          entityType: "ServiceCatalog",
          entityId: serviceId,
          metadataJson: {},
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
