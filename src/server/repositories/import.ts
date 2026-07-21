import type { ImportBatch, ImportBatchStatus } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type ImportBatchRecord = {
  profileId: string;
  uploadedByUserId: string;
  filename: string;
  status: Exclude<ImportBatchStatus, "committed">;
  rowCount: number;
  validCount: number;
  errorCount: number;
  commitTokenHash: string | null;
  createdAt: Date;
};

export interface ImportRepository {
  createBatch(input: ImportBatchRecord): Promise<ImportBatch>;
  findById(id: string): Promise<ImportBatch | null>;
  findByCommitTokenHash(commitTokenHash: string): Promise<ImportBatch | null>;
  setPreviewCounts(
    id: string,
    status: Exclude<ImportBatchStatus, "committed">,
    rowCount: number,
    validCount: number,
    errorCount: number,
  ): Promise<ImportBatch>;
}

export function createImportRepository(database: DatabaseClient = prisma): ImportRepository {
  return {
    createBatch(input) {
      return database.importBatch.create({
        data: {
          profileId: input.profileId,
          uploadedByUserId: input.uploadedByUserId,
          filename: normalizeText(input.filename),
          status: input.status,
          rowCount: input.rowCount,
          validCount: input.validCount,
          errorCount: input.errorCount,
          commitTokenHash: normalizeNullableText(input.commitTokenHash),
          createdAt: input.createdAt,
        },
      });
    },

    findById(id) {
      return database.importBatch.findUnique({ where: { id } });
    },

    findByCommitTokenHash(commitTokenHash) {
      return database.importBatch.findUnique({
        where: { commitTokenHash: normalizeText(commitTokenHash) },
      });
    },

    setPreviewCounts(id, status, rowCount, validCount, errorCount) {
      return database.importBatch.update({
        where: { id },
        data: { status, rowCount, validCount, errorCount },
      });
    },
  };
}

export const importRepository = createImportRepository();
