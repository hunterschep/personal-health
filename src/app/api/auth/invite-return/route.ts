import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/server/auth/csrf";
import { destroyCurrentSession } from "@/server/auth/session";
import { clearActiveProfileCookie } from "@/server/authorization/active-profile";
import { safeInviteReturnTo, setInviteReturnToCookie } from "@/server/auth/return-to";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

const continuationSchema = z.object({
  returnTo: z
    .string()
    .max(256)
    .refine((value) => safeInviteReturnTo(value) !== null),
  destination: z.enum(["sign-in", "register", "switch-account"]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = continuationSchema.parse(
      Object.fromEntries((await request.formData()).entries()),
    );
    await setInviteReturnToCookie(input.returnTo);
    if (input.destination === "switch-account") {
      await destroyCurrentSession();
      await clearActiveProfileCookie();
    }
    const destination = input.destination === "register" ? "/register" : "/sign-in";
    return NextResponse.redirect(appUrl(destination, request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
