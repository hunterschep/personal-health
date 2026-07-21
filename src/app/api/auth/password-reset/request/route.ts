import { NextResponse } from "next/server";
import { emailSchema } from "@/contracts/auth";
import { assertSameOrigin } from "@/server/auth/csrf";
import { configuredIdentityMailer } from "@/server/auth/identity-email";
import { sendPasswordReset } from "@/server/auth/identity-flows";
import {
  consumeLoginAttempt,
  loginRateLimitKey,
  networkRateLimitKey,
} from "@/server/auth/rate-limit";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const email = emailSchema.parse((await request.formData()).get("email"));
    const limits = [
      consumeLoginAttempt(loginRateLimitKey(email, request)),
      consumeLoginAttempt(networkRateLimitKey(request, "password-reset"), Date.now(), 10),
    ];
    const mailer = configuredIdentityMailer();
    if (mailer !== null && limits.every(({ allowed }) => allowed)) {
      await sendPasswordReset(email, mailer).catch(() => undefined);
    }
  } catch {
    // The response stays neutral so account existence and mail delivery are not disclosed.
  }
  return NextResponse.redirect(appUrl("/forgot-password?sent=1", request.url), 303);
}
