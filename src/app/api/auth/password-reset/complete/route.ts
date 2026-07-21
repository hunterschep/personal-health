import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema } from "@/contracts/auth";
import { assertSameOrigin } from "@/server/auth/csrf";
import { completePasswordReset } from "@/server/auth/identity-flows";
import { consumeLoginAttempt, networkRateLimitKey } from "@/server/auth/rate-limit";
import { appUrl } from "@/server/http/app-url";

const inputSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    path: ["confirmation"],
    message: "Passwords do not match.",
  });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const limit = consumeLoginAttempt(networkRateLimitKey(request, "password-reset-complete"));
    if (!limit.allowed) {
      return NextResponse.redirect(appUrl("/reset-password?status=rate-limit", request.url), 303);
    }
    const input = inputSchema.parse(Object.fromEntries((await request.formData()).entries()));
    const completed = await completePasswordReset(input.token, input.password);
    return NextResponse.redirect(
      appUrl(completed ? "/sign-in?reset=1" : "/reset-password?status=invalid", request.url),
      303,
    );
  } catch {
    return NextResponse.redirect(appUrl("/reset-password?status=invalid", request.url), 303);
  }
}
