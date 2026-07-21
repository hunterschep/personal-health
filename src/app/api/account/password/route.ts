import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema } from "@/contracts/auth";
import { AuthenticationError, RateLimitError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  accountRateLimitKey,
  consumeLoginAttempt,
  networkRateLimitKey,
} from "@/server/auth/rate-limit";
import { createSession, requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: passwordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ["confirmation"],
    message: "Passwords do not match.",
  });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const limits = [
      consumeLoginAttempt(accountRateLimitKey(session.user.id, "password-change")),
      consumeLoginAttempt(networkRateLimitKey(request, "password-change"), Date.now(), 10),
    ];
    if (limits.some(({ allowed }) => !allowed)) {
      throw new RateLimitError("Wait before trying the current password again.");
    }
    const input = changeSchema.parse(Object.fromEntries((await request.formData()).entries()));
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (
      user?.passwordHash === null ||
      user?.passwordHash === undefined ||
      !(await verifyPassword(user.passwordHash, input.currentPassword))
    ) {
      throw new AuthenticationError("The current password is incorrect.");
    }
    if (await verifyPassword(user.passwordHash, input.newPassword)) {
      throw new ValidationError("Choose a password that is different from the current password.");
    }
    const passwordHash = await hashPassword(input.newPassword);
    await prisma.$transaction(async (database) => {
      await database.user.update({
        where: { id: user.id },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      await database.session.deleteMany({ where: { userId: user.id } });
      await database.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "account.password_changed",
          entityType: "User",
          entityId: user.id,
          metadataJson: {},
        },
      });
    });
    await createSession(user.id);
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.redirect(appUrl("/app/settings/security?changed=1", request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
