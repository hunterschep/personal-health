import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSession } from "@/server/auth/session";
import { acceptHouseholdInvitation } from "@/server/invitations";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { token } = await params;
    const membership = await acceptHouseholdInvitation(token, session.user);
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, householdId: membership.householdId });
    }
    return NextResponse.redirect(appUrl("/app/family", request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
