import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { getServerEnv } from "@/config/env";

const payloadSchema = z.object({
  kind: z.literal("carecadence.reminder-link.v1"),
  userId: z.uuid(),
  reminderId: z.uuid(),
});

function secret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().AUTH_SECRET);
}

export async function signReminderLink(userId: string, reminderId: string): Promise<string> {
  return new SignJWT({ kind: "carecadence.reminder-link.v1", userId, reminderId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyReminderLink(
  token: string,
): Promise<{ userId: string; reminderId: string }> {
  try {
    const verified = await jwtVerify(token, secret(), { algorithms: ["HS256"], typ: "JWT" });
    const payload = payloadSchema.parse(verified.payload);
    return { userId: payload.userId, reminderId: payload.reminderId };
  } catch {
    throw new RangeError("This reminder link has expired or is not valid.");
  }
}
