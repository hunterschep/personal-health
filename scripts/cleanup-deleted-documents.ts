import "dotenv/config";

import { prisma } from "@/server/db/client";
import { deleteDocumentBlobs } from "@/server/storage";

async function main(): Promise<void> {
  const documents = await prisma.document.findMany({
    where: { deletedAt: { not: null }, blobDeletedAt: null },
    select: { id: true, storageKey: true, householdId: true, profileId: true },
    orderBy: { deletedAt: "asc" },
  });
  const result = await deleteDocumentBlobs(documents, "cleanup");
  console.info(
    JSON.stringify({
      pending: documents.length,
      deleted: result.deletedIds.length,
      failed: result.failedIds.length,
    }),
  );
  if (result.failedIds.length > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Document cleanup failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
