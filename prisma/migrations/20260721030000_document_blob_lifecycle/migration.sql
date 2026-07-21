ALTER TABLE "Document"
ADD COLUMN "blobDeletedAt" TIMESTAMPTZ(3);

CREATE INDEX "Document_deletedAt_blobDeletedAt_idx"
ON "Document"("deletedAt", "blobDeletedAt");
