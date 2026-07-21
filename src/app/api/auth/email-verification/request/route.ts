import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/auth/csrf";
import { configuredIdentityMailer } from "@/server/auth/identity-email";
import { sendEmailVerification } from "@/server/auth/identity-flows";
import { consumeLoginAttempt, networkRateLimitKey } from "@/server/auth/rate-limit";
import { requireSession } from "@/server/auth/session";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const limit = consumeLoginAttempt(networkRateLimitKey(request, "email-verification"));
    const mailer = configuredIdentityMailer();
    if (!limit.allowed || mailer === null) {
      return NextResponse.redirect(appUrl("/verify-email?status=unavailable", request.url), 303);
    }
    const result = await sendEmailVerification(session.user.id, mailer);
    return NextResponse.redirect(
      appUrl(`/verify-email?status=${result === "sent" ? "sent" : "verified"}`, request.url),
      303,
    );
  } catch {
    return NextResponse.redirect(appUrl("/verify-email?status=unavailable", request.url), 303);
  }
}
