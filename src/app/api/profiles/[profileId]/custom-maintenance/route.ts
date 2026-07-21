import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import {
  createCustomMaintenance,
  customMaintenanceInputSchema,
  isProfileOwnerOrOrganizer,
  listCustomMaintenance,
  listMaintenanceTemplates,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

type Context = { params: Promise<{ profileId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "view");
    const canAccessOwnerOnly = isProfileOwnerOrOrganizer(profile, session.user.id);
    const [items, templates] = await Promise.all([
      listCustomMaintenance(prisma, profile.id, canAccessOwnerOnly),
      listMaintenanceTemplates(prisma, profile.id, canAccessOwnerOnly),
    ]);
    return NextResponse.json(
      { items, templates },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = customMaintenanceInputSchema.parse(await request.json());
    const item = await prisma.$transaction((database) =>
      createCustomMaintenance(
        {
          database,
          profileId: profile.id,
          householdId: profile.householdId,
          actorUserId: session.user.id,
          canAccessOwnerOnly: isProfileOwnerOrOrganizer(profile, session.user.id),
        },
        input,
      ),
    );
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
