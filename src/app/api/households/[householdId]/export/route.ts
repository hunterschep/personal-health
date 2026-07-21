import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { createHouseholdExport } from "@/server/exports";
import { routeError } from "@/server/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  try {
    const { householdId } = await params;
    const { household, session } = await requireHouseholdAccess(householdId, "owner");
    const result = await createHouseholdExport(household.id, session.user.id);
    await prisma.auditLog.create({
      data: {
        householdId: household.id,
        actorUserId: session.user.id,
        action: "household.exported",
        entityType: "Household",
        entityId: household.id,
        metadataJson: {
          includedProfileCount: result.authorizedProfileIds.length,
          omittedProfileCount: result.omittedProfileIds.length,
          format: "zip",
        },
        userAgentFamily: request.headers.get("user-agent")?.slice(0, 120) ?? null,
      },
    });
    return new NextResponse(new Uint8Array(result.archive), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="carecadence-household-export.zip"',
        "Content-Type": "application/zip",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
