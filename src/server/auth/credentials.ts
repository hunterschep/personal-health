import { signInSchema } from "@/contracts/auth";
import { prisma } from "@/server/db/client";

import { verifyPassword } from "./password";

// Generated with the same Argon2id cost as real passwords. Verifying this hash
// keeps unknown-account attempts on the same expensive path as known accounts.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$HRr6wYvq4BIkVO476ZgNdw$BYAYh6/6ntJpwJwF/dxOz1DsRxEn3RnkbsMEpu82e9s";

export type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function authenticateCredentials(
  credentials: Partial<Record<"email" | "password", unknown>>,
): Promise<CredentialUser | null> {
  const parsed = signInSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const user = await prisma.user.findFirst({
    where: { emailNormalized: parsed.data.email, deletedAt: null },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const valid = await verifyPassword(passwordHash, parsed.data.password);
  if (!valid || user === null || user.passwordHash === null) return null;

  return { id: user.id, email: user.email, name: user.name };
}
