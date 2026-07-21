import { NextResponse } from "next/server";
import { signInWithAuthJs } from "@/auth";
import { signInSchema } from "@/contracts/auth";
import { assertSameOrigin } from "@/server/auth/csrf";
import { safeAppReturnTo, takeInviteReturnToCookie } from "@/server/auth/return-to";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
  loginRateLimitKey,
  networkRateLimitKey,
} from "@/server/auth/rate-limit";
import { destroyCurrentSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request) {
  let sessionIssued = false;
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const parsed = signInSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success)
      return NextResponse.redirect(appUrl("/sign-in?error=credentials", request.url), 303);

    const key = loginRateLimitKey(parsed.data.email, request);
    const networkKey = networkRateLimitKey(request, "sign-in");
    const limits = [consumeLoginAttempt(key), consumeLoginAttempt(networkKey, Date.now(), 10)];
    const blocked = limits.find((limit) => !limit.allowed);
    if (blocked !== undefined) {
      await prisma.auditLog.create({
        data: {
          action: "auth.rate_limit_reached",
          entityType: "User",
          entityId: "anonymous",
          metadataJson: {},
        },
      });
      const response = NextResponse.redirect(appUrl("/sign-in?error=rate-limit", request.url), 303);
      response.headers.set("Retry-After", String(blocked.retryAfterSeconds));
      return response;
    }

    try {
      await signInWithAuthJs("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
        redirectTo: "/app",
      });
      sessionIssued = true;
    } catch {
      return NextResponse.redirect(appUrl("/sign-in?error=credentials", request.url), 303);
    }

    const user = await prisma.user.findFirst({
      where: { emailNormalized: parsed.data.email, deletedAt: null },
      select: { id: true },
    });
    if (user === null) throw new Error("Authenticated account is no longer available.");

    clearLoginAttempts(key);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "auth.sign_in",
          entityType: "User",
          entityId: user.id,
          metadataJson: {},
        },
      }),
    ]);
    const inviteReturnTo = await takeInviteReturnToCookie();
    const returnTo = safeAppReturnTo(form.get("returnTo")) ?? inviteReturnTo ?? "/app";
    return NextResponse.redirect(appUrl(returnTo, request.url), 303);
  } catch {
    if (sessionIssued) {
      await destroyCurrentSession().catch(() => undefined);
    }
    return NextResponse.redirect(appUrl("/sign-in?error=credentials", request.url), 303);
  }
}
