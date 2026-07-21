import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { optionalText, routeError } from "@/server/http";
import {
  storedVisitPrepDraft,
  visitPrepPreferenceInputSchema,
} from "@/server/visit-prep/preferences";

type Context = { params: Promise<{ profileId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "view");
    const preference = await prisma.visitPrepPreference.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
    });
    return NextResponse.json(
      { draft: storedVisitPrepDraft(preference) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "edit");
    const input = visitPrepPreferenceInputSchema.parse(await request.json());
    await prisma.visitPrepPreference.upsert({
      where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
      create: {
        userId: session.user.id,
        profileId: profile.id,
        mode: input.mode,
        sectionsJson: input.sections,
        questionsJson: input.questions,
        personalNotes: optionalText(input.personalNotes),
      },
      update: {
        mode: input.mode,
        sectionsJson: input.sections,
        questionsJson: input.questions,
        personalNotes: optionalText(input.personalNotes),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
