import path from "node:path";

import { disconnectDatabase, prisma } from "@/server/db/client";
import { sourceCacheRepository } from "@/server/repositories/source-cache";
import { guidelineRepository } from "@/server/repositories/guideline";
import { JsonFileSourceCacheStorage, type SourceCacheStorage } from "@/server/sources/cache";
import { createRepositorySourceCacheStorage } from "@/server/sources/repository-storage";
import { parseSourceReviewCommand, sourceReviewAuditData } from "@/server/sources/review";

function sourceCachePath(): string {
  const configured = process.env.SOURCE_CACHE_FILE;
  if (configured !== undefined && configured.trim() !== "") return path.resolve(configured);
  return path.resolve(process.env.UPLOAD_DIR ?? "uploads", "source-cache.json");
}

async function main(): Promise<void> {
  const command = parseSourceReviewCommand(process.argv.slice(2));
  let storage: SourceCacheStorage;
  if (command.fileCache) {
    storage = new JsonFileSourceCacheStorage(sourceCachePath());
  } else {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === "") {
      throw new Error("DATABASE_URL is required unless --file-cache is used.");
    }
    storage = await createRepositorySourceCacheStorage({
      sourceSlug: command.sourceSlug,
      sourceRepository: guidelineRepository,
      cacheRepository: sourceCacheRepository,
    });
  }
  await storage.recordReview(command.sourceSlug, command.cacheKey, command.decision);
  if (!command.fileCache) {
    const source = await guidelineRepository.findSourceBySlug(command.sourceSlug);
    if (source === null) throw new Error(`Seeded source was not found: ${command.sourceSlug}.`);
    await prisma.auditLog.create({
      data: sourceReviewAuditData(source.id, command.decision.decision),
    });
  }
  process.stdout.write(
    `Recorded ${command.decision.decision} review decision for 1 cached source revision.\n`,
  );
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown source review failure.";
    process.stderr.write(`Source review failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
