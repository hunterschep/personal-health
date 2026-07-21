import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import {
  adoptMaintenanceTemplate,
  isProfileOwnerOrOrganizer,
  maintenanceTemplateAdoptionSchema,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";

type Context = { params: Promise<{ profileId: string; templateSlug: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, templateSlug } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = maintenanceTemplateAdoptionSchema.parse(await request.json());
    const item = await prisma.$transaction((database) =>
      adoptMaintenanceTemplate(
        {
          database,
          profileId: profile.id,
          householdId: profile.householdId,
          actorUserId: session.user.id,
          canAccessOwnerOnly: isProfileOwnerOrOrganizer(profile, session.user.id),
        },
        templateSlug,
        input,
      ),
    );
    return NextResponse.json(item);
  } catch (error) {
    return routeError(error);
  }
}
