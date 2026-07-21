import { NextResponse } from "next/server";

import { getServerEnv } from "@/config/env";
import { NotFoundError } from "@/domain/shared/errors";
import { requireSession } from "@/server/auth/session";
import { requireProfileAccess } from "@/server/authorization/profile";
import { createIcs, plannedActionCalendarEvent } from "@/server/calendar";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSession();
    const action = await prisma.plannedAction.findUnique({ where: { id } });
    if (action === null) throw new NotFoundError();
    const { profile, session } = await requireProfileAccess(action.profileId, "export");
    const event = plannedActionCalendarEvent(action, getServerEnv().APP_BASE_URL);
    if (event === null)
      throw new NotFoundError("This planned action does not have a calendar date.");
    await prisma.auditLog.create({
      data: {
        householdId: profile.householdId,
        profileId: profile.id,
        actorUserId: session.user.id,
        action: "planned_action.calendar_exported",
        entityType: "PlannedAction",
        entityId: action.id,
        metadataJson: { format: "ics" },
        userAgentFamily: request.headers.get("user-agent")?.slice(0, 120) ?? null,
      },
    });
    return new NextResponse(createIcs([event]), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="carecadence-planned-action.ics"',
        "Content-Type": "text/calendar; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
