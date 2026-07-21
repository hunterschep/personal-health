import type { DatabaseClient } from "@/server/db";
import { prisma } from "@/server/db/client";

import { createOpaqueToken, hashOpaqueToken } from "./tokens";

export type IdentityTokenPurpose = "email-verification" | "password-reset";

const TOKEN_LIFETIMES_SECONDS: Record<IdentityTokenPurpose, number> = {
  "email-verification": 24 * 60 * 60,
  "password-reset": 60 * 60,
};

function identifier(purpose: IdentityTokenPurpose, userId: string): string {
  return `${purpose}:${userId}`;
}

export async function issueIdentityToken(
  userId: string,
  purpose: IdentityTokenPurpose,
): Promise<string> {
  const { raw, hash } = createOpaqueToken();
  const tokenIdentifier = identifier(purpose, userId);
  const expires = new Date(Date.now() + TOKEN_LIFETIMES_SECONDS[purpose] * 1000);
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier } }),
    prisma.verificationToken.create({
      data: { identifier: tokenIdentifier, token: hash, expires },
    }),
  ]);
  return raw;
}

export async function consumeIdentityToken(
  database: DatabaseClient,
  rawToken: string,
  purpose: IdentityTokenPurpose,
): Promise<string | null> {
  const token = await database.verificationToken.findUnique({
    where: { token: hashOpaqueToken(rawToken) },
  });
  const prefix = `${purpose}:`;
  if (token === null || token.expires <= new Date() || !token.identifier.startsWith(prefix)) {
    return null;
  }
  await database.verificationToken.delete({
    where: {
      identifier_token: { identifier: token.identifier, token: token.token },
    },
  });
  return token.identifier.slice(prefix.length);
}
