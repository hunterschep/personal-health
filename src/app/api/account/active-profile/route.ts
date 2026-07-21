import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/server/auth/csrf";
import { setActiveProfileCookie } from "@/server/authorization/active-profile";
import { requireProfileAccess } from "@/server/authorization/profile";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

const selectionSchema = z.object({
  profileId: z.uuid(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const jsonRequest = request.headers.get("content-type")?.includes("application/json") === true;
    const input = selectionSchema.parse(
      jsonRequest ? await request.json() : Object.fromEntries((await request.formData()).entries()),
    );
    const { profile, session } = await requireProfileAccess(input.profileId, "view");
    await setActiveProfileCookie(profile.id, session.expiresAt);
    if (!jsonRequest) {
      return NextResponse.redirect(
        appUrl(`/app/profile/${profile.id}/care-plan`, request.url),
        303,
      );
    }
    return NextResponse.json(
      { profileId: profile.id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
