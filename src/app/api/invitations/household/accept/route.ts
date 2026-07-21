import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSession } from "@/server/auth/session";
import { acceptHouseholdInvitation } from "@/server/invitations";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

const tokenSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = tokenSchema.parse(Object.fromEntries((await request.formData()).entries()));
    const membership = await acceptHouseholdInvitation(input.token, session.user);
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, householdId: membership.householdId });
    }
    return NextResponse.redirect(appUrl("/app/family", request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
