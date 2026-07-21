import type { Document, DocumentLink } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeText } from "./normalize";

export type DocumentRecord = {
  householdId: string;
  profileId: string;
  storageKey: string;
  originalFilename: string;
  safeFilename: string;
  mimeType: string;
  sizeBytes: bigint;
  sha256: string;
  uploadedByUserId: string;
};

type DocumentLinkTarget =
  | { careEventId: string; medicationId: null; clinicianOverrideId: null }
  | { careEventId: null; medicationId: string; clinicianOverrideId: null }
  | { careEventId: null; medicationId: null; clinicianOverrideId: string };

export type DocumentLinkRecord = DocumentLinkTarget & {
  documentId: string;
  label: string;
};

export interface DocumentRepository {
  create(input: DocumentRecord): Promise<Document>;
  link(input: DocumentLinkRecord): Promise<DocumentLink>;
  findActiveById(id: string): Promise<Document | null>;
  findActiveByStorageKey(storageKey: string): Promise<Document | null>;
  listActiveForProfile(profileId: string): Promise<Document[]>;
  softDelete(id: string, deletedAt: Date): Promise<Document>;
}

export function createDocumentRepository(database: DatabaseClient = prisma): DocumentRepository {
  return {
    create(input) {
      return database.document.create({
        data: {
          householdId: input.householdId,
          profileId: input.profileId,
          storageKey: normalizeText(input.storageKey),
          originalFilename: normalizeText(input.originalFilename),
          safeFilename: normalizeText(input.safeFilename),
          mimeType: normalizeText(input.mimeType),
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
          uploadedByUserId: input.uploadedByUserId,
        },
      });
    },

    link(input) {
      return database.documentLink.create({
        data: {
          documentId: input.documentId,
          careEventId: input.careEventId,
          medicationId: input.medicationId,
          clinicianOverrideId: input.clinicianOverrideId,
          label: normalizeText(input.label),
        },
      });
    },

    findActiveById(id) {
      return database.document.findFirst({ where: { id, deletedAt: null } });
    },

    findActiveByStorageKey(storageKey) {
      return database.document.findFirst({
        where: { storageKey: normalizeText(storageKey), deletedAt: null },
      });
    },

    listActiveForProfile(profileId) {
      return database.document.findMany({
        where: { profileId, deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
    },

    softDelete(id, deletedAt) {
      return database.document.update({ where: { id }, data: { deletedAt } });
    },
  };
}

export const documentRepository = createDocumentRepository();
