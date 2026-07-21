import { NextResponse } from "next/server";
import { z } from "zod";
import { ConflictError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { createOpaqueToken } from "@/server/auth/tokens";
import { requireHouseholdAccess } from "@/server/authorization/household";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

const inviteSchema = z.object({
  email: z.email().transform((value) => value.trim().toLocaleLowerCase("en-US")),
  role: z.enum(["admin", "member"]).default("member"),
});

async function body(request: Request): Promise<unknown> {
  return request.headers.get("content-type")?.includes("application/json") === true
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  try {
    const { householdId } = await params;
    const { household } = await requireHouseholdAccess(householdId, "manage");
    const invites = await prisma.householdInvite.findMany({
      where: { householdId: household.id, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, emailNormalized: true, role: true, expiresAt: true, createdAt: true },
    });
    return NextResponse.json(invites, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { householdId } = await params;
    const { session, household } = await requireHouseholdAccess(householdId, "manage");
    const input = inviteSchema.parse(await body(request));
    const existingMember = await prisma.householdMember.findFirst({
      where: {
        householdId: household.id,
        removedAt: null,
        user: { emailNormalized: input.email, deletedAt: null },
      },
    });
    if (existingMember !== null)
      throw new ConflictError("That person is already a household member.");
    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    const invite = await prisma.$transaction(async (database) => {
      await database.householdInvite.updateMany({
        where: {
          householdId: household.id,
          emailNormalized: input.email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      const created = await database.householdInvite.create({
        data: {
          householdId: household.id,
          emailNormalized: input.email,
          role: input.role,
          tokenHash: token.hash,
          expiresAt,
          invitedByUserId: session.user.id,
        },
      });
      await database.auditLog.create({
        data: {
          householdId: household.id,
          actorUserId: session.user.id,
          action: "household.invite_created",
          entityType: "HouseholdInvite",
          entityId: created.id,
          metadataJson: { role: input.role },
        },
      });
      return created;
    });
    return NextResponse.json(
      {
        ok: true,
        inviteId: invite.id,
        acceptPath: `/invite/household/${token.raw}`,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
