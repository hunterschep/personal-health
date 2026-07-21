import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "./client";

export type TransactionClient = Prisma.TransactionClient;
export type DatabaseClient = TransactionClient;

export type TransactionCallback<T> = (transaction: TransactionClient) => Promise<T>;

export function withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  return prisma.$transaction(callback, {
    isolationLevel: "ReadCommitted",
    maxWait: 5_000,
    timeout: 15_000,
  });
}

export function withSerializableTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  return prisma.$transaction(callback, {
    isolationLevel: "Serializable",
    maxWait: 5_000,
    timeout: 20_000,
  });
}
