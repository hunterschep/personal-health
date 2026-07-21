import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const sharingSchema = z.object({
  visibility: z.enum(["owner_only", "selected_members", "household"]),
  grants: z
    .array(
      z.object({
        userId: z.uuid(),
        permission: z.enum(["view", "edit", "manage"]),
      }),
    )
    .max(100),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile } = await requireProfileAccess(profileId, "manage");
    const [grants, members] = await Promise.all([
      prisma.profileAccessGrant.findMany({ where: { profileId: profile.id } }),
      prisma.householdMember.findMany({
        where: { householdId: profile.householdId, removedAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      }),
    ]);
    return NextResponse.json(
      {
        visibility: profile.visibility,
        grants,
        members: members
          .filter((member) => member.userId !== profile.ownerUserId)
          .map((member) => ({ ...member.user, role: member.role })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "manage");
    const input = sharingSchema.parse(await request.json());
    const uniqueUserIds = new Set(input.grants.map(({ userId }) => userId));
    if (uniqueUserIds.size !== input.grants.length) {
      throw new ValidationError("Each household member can have one profile permission.");
    }
    const activeMembers = await prisma.householdMember.findMany({
      where: {
        householdId: profile.householdId,
        removedAt: null,
        userId: { in: [...uniqueUserIds] },
      },
      select: { userId: true },
    });
    if (activeMembers.length !== uniqueUserIds.size) {
      throw new ValidationError("Profile access can only be granted to active household members.");
    }
    if (profile.ownerUserId !== null && uniqueUserIds.has(profile.ownerUserId)) {
      throw new ValidationError("The profile owner does not need a separate access grant.");
    }

    await prisma.$transaction(async (database) => {
      await database.profile.update({
        where: { id: profile.id },
        data: { visibility: input.visibility },
      });
      await database.profileAccessGrant.deleteMany({ where: { profileId: profile.id } });
      if (input.visibility === "selected_members" && input.grants.length > 0) {
        await database.profileAccessGrant.createMany({
          data: input.grants.map((grant) => ({
            profileId: profile.id,
            userId: grant.userId,
            permission: grant.permission,
            grantedByUserId: session.user.id,
          })),
        });
      }
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "profile.sharing_updated",
          entityType: "Profile",
          entityId: profile.id,
          metadataJson: { visibility: input.visibility, grantCount: input.grants.length },
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
