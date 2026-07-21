import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { authCookiesAreSecure, SESSION_COOKIE_NAME } from "@/config/auth";
import { getServerEnv } from "@/config/env";
import { AuthenticationError } from "@/domain/shared/errors";
import { prisma } from "@/server/db/client";

export function hashSessionToken(token: string): string {
  return createHmac("sha256", getServerEnv().AUTH_SECRET).update(token).digest("hex");
}

type StoredSessionToken = {
  rawToken: string;
  sessionId: string;
  expiresAt: Date;
};

export async function issueSessionToken(
  userId: string,
  options: { sessionId?: string; maxAgeSeconds?: number } = {},
): Promise<StoredSessionToken> {
  const environment = getServerEnv();
  const rawToken = randomBytes(32).toString("base64url");
  const maxAgeSeconds = options.maxAgeSeconds ?? environment.SESSION_DURATION_DAYS * 86_400;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
  const sessionToken = hashSessionToken(rawToken);

  if (options.sessionId !== undefined) {
    const rotated = await prisma.session.updateMany({
      where: { id: options.sessionId, userId, expires: { gt: new Date() } },
      data: { sessionToken, expires: expiresAt },
    });
    if (rotated.count === 1) {
      return { rawToken, sessionId: options.sessionId, expiresAt };
    }
  }

  const session = await prisma.session.create({
    data: { sessionToken, userId, expires: expiresAt },
    select: { id: true },
  });
  return { rawToken, sessionId: session.id, expiresAt };
}

export async function sessionTokenClaims(rawToken: string): Promise<{
  sessionId: string;
  userId: string;
  email: string;
  name: string | null;
  sessionVersion: number;
  expiresAt: Date;
} | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionToken(rawToken) },
    include: { user: true },
  });
  if (session === null || session.expires <= new Date() || session.user.deletedAt !== null) {
    return null;
  }
  return {
    sessionId: session.id,
    userId: session.userId,
    email: session.user.email,
    name: session.user.name,
    sessionVersion: session.user.sessionVersion,
    expiresAt: session.expires,
  };
}

export async function deleteSessionById(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export type AuthenticatedSession = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    sessionVersion: number;
  };
  expiresAt: Date;
};

export async function createSession(userId: string): Promise<void> {
  const environment = getServerEnv();
  const { rawToken, expiresAt } = await issueSessionToken(userId);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: authCookiesAreSecure(environment),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function rotateSession(userId: string): Promise<void> {
  await destroyCurrentSession();
  await createSession(userId);
}

export async function destroyCurrentSession(): Promise<void> {
  const environment = getServerEnv();
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken !== undefined) {
    await prisma.session.deleteMany({ where: { sessionToken: hashSessionToken(rawToken) } });
  }
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: authCookiesAreSecure(environment),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function destroyAllSessions(userId: string): Promise<void> {
  const environment = getServerEnv();
  await prisma.session.deleteMany({ where: { userId } });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: authCookiesAreSecure(environment),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export const getSession = cache(async (): Promise<AuthenticatedSession | null> => {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken === undefined) return null;

  const claims = await sessionTokenClaims(rawToken);
  if (claims === null) return null;
  return {
    sessionId: claims.sessionId,
    user: {
      id: claims.userId,
      email: claims.email,
      name: claims.name,
      sessionVersion: claims.sessionVersion,
    },
    expiresAt: claims.expiresAt,
  };
});

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getSession();
  if (session === null) throw new AuthenticationError();
  return session;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
