import type { User } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeEmail, normalizeNullableText, normalizeText } from "./normalize";

export type CreateUserRecord = {
  email: string;
  passwordHash: string;
  name: string;
};

export interface UserRepository {
  create(input: CreateUserRecord): Promise<User>;
  findActiveById(id: string): Promise<User | null>;
  findActiveByEmail(email: string): Promise<User | null>;
  recordLogin(id: string, at: Date): Promise<User>;
  incrementSessionVersion(id: string): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<User>;
  softDelete(id: string, at: Date): Promise<User>;
}

export function createUserRepository(database: DatabaseClient = prisma): UserRepository {
  return {
    create(input) {
      const email = normalizeEmail(input.email);
      return database.user.create({
        data: {
          email,
          emailNormalized: email,
          passwordHash: normalizeText(input.passwordHash),
          name: normalizeNullableText(input.name),
        },
      });
    },

    findActiveById(id) {
      return database.user.findFirst({ where: { id, deletedAt: null } });
    },

    findActiveByEmail(email) {
      return database.user.findFirst({
        where: { emailNormalized: normalizeEmail(email), deletedAt: null },
      });
    },

    recordLogin(id, at) {
      return database.user.update({ where: { id }, data: { lastLoginAt: at } });
    },

    incrementSessionVersion(id) {
      return database.user.update({
        where: { id },
        data: { sessionVersion: { increment: 1 } },
      });
    },

    updatePassword(id, passwordHash) {
      return database.user.update({
        where: { id },
        data: {
          passwordHash: normalizeText(passwordHash),
          sessionVersion: { increment: 1 },
        },
      });
    },

    softDelete(id, at) {
      return database.user.update({
        where: { id },
        data: { deletedAt: at, sessionVersion: { increment: 1 } },
      });
    },
  };
}

export const userRepository = createUserRepository();
