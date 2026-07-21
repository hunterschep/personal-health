import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/auth/csrf";
import { destroyCurrentSession } from "@/server/auth/session";
import { appUrl } from "@/server/http/app-url";
import { clearInviteReturnToCookie } from "@/server/auth/return-to";
import { clearActiveProfileCookie } from "@/server/authorization/active-profile";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroyCurrentSession();
    await clearActiveProfileCookie();
    await clearInviteReturnToCookie();
  } catch {
    // The response remains a neutral sign-out even when a stale cookie cannot be deleted in storage.
  }
  return NextResponse.redirect(appUrl("/sign-in", request.url), 303);
}
