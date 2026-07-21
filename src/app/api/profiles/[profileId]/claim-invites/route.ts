import { NextResponse } from "next/server";
import { z } from "zod";
import { ConflictError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { createOpaqueToken } from "@/server/auth/tokens";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const claimSchema = z.object({
  profileId: z.uuid().optional(),
  email: z.email().transform((value) => value.trim().toLocaleLowerCase("en-US")),
});

async function body(request: Request): Promise<unknown> {
  return request.headers.get("content-type")?.includes("application/json") === true
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile } = await requireProfileAccess(profileId, "manage");
    const invites = await prisma.profileClaimInvite.findMany({
      where: {
        profileId: profile.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, emailNormalized: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      {
        invites: invites.map((invite) => ({
          id: invite.id,
          email: invite.emailNormalized,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const path = await params;
    const input = claimSchema.parse(await body(request));
    const requestedProfileId = input.profileId ?? path.profileId;
    const { session, profile } = await requireProfileAccess(requestedProfileId, "manage");
    if (profile.ownerUserId !== null || profile.claimedAt !== null) {
      throw new ConflictError("This adult profile already has an owner.");
    }
    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    const invite = await prisma.$transaction(async (database) => {
      await database.profileClaimInvite.updateMany({
        where: { profileId: profile.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const created = await database.profileClaimInvite.create({
        data: {
          profileId: profile.id,
          emailNormalized: input.email,
          tokenHash: token.hash,
          expiresAt,
          createdByUserId: session.user.id,
        },
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "profile.claim_invite_created",
          entityType: "ProfileClaimInvite",
          entityId: created.id,
          metadataJson: {},
        },
      });
      return created;
    });
    return NextResponse.json(
      {
        ok: true,
        inviteId: invite.id,
        acceptPath: `/invite/profile/${token.raw}`,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
