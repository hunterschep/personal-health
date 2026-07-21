import { PrismaPg } from "@prisma/adapter-pg";

import { getServerEnv } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

type GlobalPrisma = typeof globalThis & {
  __careCadencePrisma?: PrismaClient;
};

let processClient: PrismaClient | undefined;

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    application_name: "carecadence",
  });

  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  const globalScope = globalThis as GlobalPrisma;

  if (globalScope.__careCadencePrisma !== undefined) {
    return globalScope.__careCadencePrisma;
  }

  if (processClient !== undefined) {
    return processClient;
  }

  const client = createPrismaClient(getServerEnv().DATABASE_URL);
  processClient = client;

  if (process.env.NODE_ENV !== "production") {
    globalScope.__careCadencePrisma = client;
  }

  return client;
}

const lazyClientTarget = Object.create(null) as PrismaClient;

export const prisma = new Proxy(lazyClientTarget, {
  get(_target, property) {
    const client = getPrismaClient();
    const value: unknown = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectDatabase(): Promise<void> {
  if (processClient !== undefined) {
    await processClient.$disconnect();
    processClient = undefined;
  }
}
