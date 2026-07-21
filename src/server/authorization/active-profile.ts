import { cookies } from "next/headers";
import { authCookiesAreSecure } from "@/config/auth";
import { getServerEnv } from "@/config/env";
import { prisma } from "@/server/db/client";
import { accessibleProfileWhere } from "./profile-query";

const ACTIVE_PROFILE_COOKIE = "carecadence.active-profile";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function preferredProfileId(): Promise<string | null> {
  const value = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value;
  return value !== undefined && UUID_PATTERN.test(value) ? value : null;
}

export function chooseActiveProfileId(
  preferredId: string | null,
  accessibleProfileIds: readonly string[],
): string | null {
  if (preferredId !== null && accessibleProfileIds.includes(preferredId)) return preferredId;
  return accessibleProfileIds[0] ?? null;
}

export async function resolveActiveProfileFromList<T extends { id: string }>(
  profiles: readonly T[],
): Promise<T | null> {
  const selectedId = chooseActiveProfileId(
    await preferredProfileId(),
    profiles.map(({ id }) => id),
  );
  return profiles.find(({ id }) => id === selectedId) ?? null;
}

export async function resolveActiveProfileId(userId: string): Promise<string | null> {
  const preferredId = await preferredProfileId();
  if (preferredId !== null) {
    const preferred = await prisma.profile.findFirst({
      where: {
        AND: [{ id: preferredId }, accessibleProfileWhere(userId)],
      },
      select: { id: true },
    });
    if (preferred !== null) return preferred.id;
  }

  const fallback = await prisma.profile.findFirst({
    where: accessibleProfileWhere(userId),
    orderBy: [{ createdAt: "asc" }, { displayName: "asc" }],
    select: { id: true },
  });
  return fallback?.id ?? null;
}

export async function setActiveProfileCookie(profileId: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    secure: authCookiesAreSecure(getServerEnv()),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearActiveProfileCookie(): Promise<void> {
  const environment = getServerEnv();
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, "", {
    httpOnly: true,
    secure: authCookiesAreSecure(environment),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export function activeProfileCookieName(): string {
  return ACTIVE_PROFILE_COOKIE;
}
