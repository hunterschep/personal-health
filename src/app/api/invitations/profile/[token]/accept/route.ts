import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSession } from "@/server/auth/session";
import { setActiveProfileCookie } from "@/server/authorization/active-profile";
import { acceptProfileClaimInvitation } from "@/server/invitations";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { token } = await params;
    const profile = await acceptProfileClaimInvitation(token, session.user);
    await setActiveProfileCookie(profile.id, session.expiresAt);
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, profileId: profile.id });
    }
    return NextResponse.redirect(appUrl(`/app/profile/${profile.id}/care-plan`, request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
