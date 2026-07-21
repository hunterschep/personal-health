import { cookies } from "next/headers";
import { authCookiesAreSecure } from "@/config/auth";
import { getServerEnv } from "@/config/env";

const INVITE_RETURN_COOKIE = "carecadence.invite-return";
const INVITE_PATH = /^\/invite\/(?:household|profile)\/[A-Za-z0-9_-]{32,128}$/;

export function safeAppReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return null;
  }
  return value === "/app" || value.startsWith("/app/") || value.startsWith("/app?") ? value : null;
}

export function safeInviteReturnTo(value: unknown): string | null {
  return typeof value === "string" && INVITE_PATH.test(value) ? value : null;
}

export async function setInviteReturnToCookie(returnTo: string): Promise<void> {
  const safeReturnTo = safeInviteReturnTo(returnTo);
  if (safeReturnTo === null) throw new RangeError("The invitation is not available.");
  (await cookies()).set(INVITE_RETURN_COOKIE, safeReturnTo, {
    httpOnly: true,
    secure: authCookiesAreSecure(getServerEnv()),
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
    priority: "high",
  });
}

export async function takeInviteReturnToCookie(): Promise<string | null> {
  const environment = getServerEnv();
  const store = await cookies();
  const returnTo = safeInviteReturnTo(store.get(INVITE_RETURN_COOKIE)?.value);
  store.set(INVITE_RETURN_COOKIE, "", {
    httpOnly: true,
    secure: authCookiesAreSecure(environment),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return returnTo;
}

export async function clearInviteReturnToCookie(): Promise<void> {
  const environment = getServerEnv();
  const store = await cookies();
  store.set(INVITE_RETURN_COOKIE, "", {
    httpOnly: true,
    secure: authCookiesAreSecure(environment),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export function inviteReturnToCookieName(): string {
  return INVITE_RETURN_COOKIE;
}
