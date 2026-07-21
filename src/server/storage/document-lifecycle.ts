import { prisma } from "@/server/db/client";

import { privateStorage } from "./local";

export type PendingDocumentBlob = {
  id: string;
  storageKey: string;
  householdId: string;
  profileId: string;
};

export type BlobDeletionResult = {
  deletedIds: string[];
  failedIds: string[];
};

/**
 * Removes soft-deleted document blobs and records successful physical deletion.
 * Failures remain queryable through `blobDeletedAt IS NULL` for a later retry.
 */
export async function deleteDocumentBlobs(
  documents: readonly PendingDocumentBlob[],
  attempt: "request" | "cleanup" = "request",
): Promise<BlobDeletionResult> {
  const deletedIds: string[] = [];
  const failed: PendingDocumentBlob[] = [];

  for (const document of documents) {
    try {
      await privateStorage.delete(document.storageKey);
      deletedIds.push(document.id);
    } catch {
      failed.push(document);
    }
  }

  if (deletedIds.length > 0) {
    await prisma.document.updateMany({
      where: { id: { in: deletedIds }, deletedAt: { not: null }, blobDeletedAt: null },
      data: { blobDeletedAt: new Date() },
    });
  }

  if (failed.length > 0) {
    await prisma.auditLog.createMany({
      data: failed.map((document) => ({
        householdId: document.householdId,
        profileId: document.profileId,
        action: "document.blob_delete_failed",
        entityType: "Document",
        entityId: document.id,
        metadataJson: { attempt },
      })),
    });
  }

  return { deletedIds, failedIds: failed.map(({ id }) => id) };
}
