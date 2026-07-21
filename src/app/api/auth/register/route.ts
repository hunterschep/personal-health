import { NextResponse } from "next/server";
import { registrationSchema } from "@/contracts/auth";
import { assertSameOrigin } from "@/server/auth/csrf";
import { configuredIdentityMailer } from "@/server/auth/identity-email";
import { sendEmailVerification } from "@/server/auth/identity-flows";
import { hashPassword } from "@/server/auth/password";
import {
  safeAppReturnTo,
  setInviteReturnToCookie,
  takeInviteReturnToCookie,
} from "@/server/auth/return-to";
import { createSession } from "@/server/auth/session";
import { consumeLoginAttempt, networkRateLimitKey } from "@/server/auth/rate-limit";
import { prisma } from "@/server/db/client";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const limit = consumeLoginAttempt(networkRateLimitKey(request, "register"));
    if (!limit.allowed) {
      const response = NextResponse.redirect(
        appUrl("/register?error=rate-limit", request.url),
        303,
      );
      response.headers.set("Retry-After", String(limit.retryAfterSeconds));
      return response;
    }
    const form = await request.formData();
    const input = registrationSchema.safeParse(Object.fromEntries(form.entries()));
    if (!input.success) {
      return NextResponse.redirect(appUrl("/register?error=invalid", request.url), 303);
    }

    const existing = await prisma.user.findFirst({
      where: { emailNormalized: input.data.email, deletedAt: null },
      select: { id: true },
    });
    if (existing !== null) {
      return NextResponse.redirect(appUrl("/register?error=unavailable", request.url), 303);
    }

    const identityMailer = configuredIdentityMailer();
    const passwordHash = await hashPassword(input.data.password);
    const user = await prisma.user.create({
      data: {
        name: input.data.name,
        email: input.data.email,
        emailNormalized: input.data.email,
        passwordHash,
        emailVerified: identityMailer === null ? new Date() : null,
      },
    });
    await createSession(user.id);
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "account.registered",
        entityType: "User",
        entityId: user.id,
        metadataJson: {},
      },
    });
    const inviteReturnTo = await takeInviteReturnToCookie();
    if (identityMailer !== null) {
      if (inviteReturnTo !== null) await setInviteReturnToCookie(inviteReturnTo);
      const sent = await sendEmailVerification(user.id, identityMailer)
        .then(() => true)
        .catch(() => false);
      return NextResponse.redirect(
        appUrl(`/verify-email?${sent ? "pending=1" : "status=unavailable"}`, request.url),
        303,
      );
    }
    const returnTo = safeAppReturnTo(form.get("returnTo")) ?? inviteReturnTo ?? "/app/onboarding";
    return NextResponse.redirect(appUrl(returnTo, request.url), 303);
  } catch {
    return NextResponse.redirect(appUrl("/register?error=unavailable", request.url), 303);
  }
}
