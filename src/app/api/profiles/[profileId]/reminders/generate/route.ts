import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { routeError } from "@/server/http";
import { generateRemindersForProfile } from "@/server/reminders";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { profile } = await requireProfileAccess(profileId, "edit");
    const result = await generateRemindersForProfile(profile.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
