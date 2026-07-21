import { NextResponse } from "next/server";

import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { createProfileExport } from "@/server/exports";
import { routeError } from "@/server/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "export");
    const archive = await createProfileExport(profile.id);
    await prisma.auditLog.create({
      data: {
        householdId: profile.householdId,
        profileId: profile.id,
        actorUserId: session.user.id,
        action: "profile.exported",
        entityType: "Profile",
        entityId: profile.id,
        metadataJson: { format: "zip" },
        userAgentFamily: request.headers.get("user-agent")?.slice(0, 120) ?? null,
      },
    });
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="carecadence-profile-export.zip"',
        "Content-Type": "application/zip",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
