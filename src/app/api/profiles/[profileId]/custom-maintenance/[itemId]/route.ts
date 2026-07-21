import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import {
  customMaintenanceInputSchema,
  disableCustomMaintenance,
  isProfileOwnerOrOrganizer,
  updateCustomMaintenance,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

type Context = { params: Promise<{ profileId: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, itemId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = customMaintenanceInputSchema.parse(await request.json());
    const item = await prisma.$transaction((database) =>
      updateCustomMaintenance(
        {
          database,
          profileId: profile.id,
          householdId: profile.householdId,
          actorUserId: session.user.id,
          canAccessOwnerOnly: isProfileOwnerOrOrganizer(profile, session.user.id),
        },
        itemId,
        input,
      ),
    );
    return NextResponse.json(item);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, itemId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    await prisma.$transaction((database) =>
      disableCustomMaintenance(
        {
          database,
          profileId: profile.id,
          householdId: profile.householdId,
          actorUserId: session.user.id,
          canAccessOwnerOnly: isProfileOwnerOrOrganizer(profile, session.user.id),
        },
        itemId,
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
