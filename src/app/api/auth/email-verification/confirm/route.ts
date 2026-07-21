import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/server/auth/csrf";
import { confirmEmailVerification } from "@/server/auth/identity-flows";
import { takeInviteReturnToCookie } from "@/server/auth/return-to";
import { getSession } from "@/server/auth/session";
import { appUrl } from "@/server/http/app-url";

const inputSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = inputSchema.parse(Object.fromEntries((await request.formData()).entries()));
    const userId = await confirmEmailVerification(input.token);
    if (userId === null) {
      return NextResponse.redirect(appUrl("/verify-email?status=invalid", request.url), 303);
    }
    const session = await getSession();
    if (session?.user.id !== userId) {
      return NextResponse.redirect(appUrl("/sign-in?verified=1", request.url), 303);
    }
    const inviteReturnTo = await takeInviteReturnToCookie();
    return NextResponse.redirect(appUrl(inviteReturnTo ?? "/app/onboarding", request.url), 303);
  } catch {
    return NextResponse.redirect(appUrl("/verify-email?status=invalid", request.url), 303);
  }
}
