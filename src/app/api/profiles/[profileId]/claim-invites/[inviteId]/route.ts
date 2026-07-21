import { NextResponse } from "next/server";
import { NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ profileId: string; inviteId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId, inviteId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "manage");
    await prisma.$transaction(async (database) => {
      const revoked = await database.profileClaimInvite.updateMany({
        where: {
          id: inviteId,
          profileId: profile.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new NotFoundError();
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "profile.claim_invite_revoked",
          entityType: "ProfileClaimInvite",
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
