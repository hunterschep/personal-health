import path from "node:path";
import {
  JsonFileSourceCacheStorage,
  loadMyHealthfinderContent,
  MYHEALTHFINDER_SOURCE_SLUG,
  type SourceCacheStorage,
} from "../src/server/sources/cache";
import {
  MyHealthfinderClient,
  type AnonymousMyHealthfinderInput,
} from "../src/server/sources/myhealthfinder";
import { disconnectDatabase } from "../src/server/db/client";
import { createRepositorySourceCacheStorage } from "../src/server/sources/repository-storage";

const KNOWN_ANONYMOUS_PROFILES: readonly AnonymousMyHealthfinderInput[] = [
  { age: 18, sex: "female", language: "en" },
  { age: 18, sex: "male", language: "en" },
  { age: 35, sex: "female", pregnant: "no", language: "en" },
  { age: 45, sex: "male", tobaccoUse: "no", language: "en" },
  { age: 65, sex: "female", tobaccoUse: "no", language: "en" },
  { age: 65, sex: "male", tobaccoUse: "no", language: "en" },
];

function sourceCachePath(): string {
  const configured = process.env.SOURCE_CACHE_FILE;
  if (configured !== undefined && configured.trim() !== "") return path.resolve(configured);
  return path.resolve(process.env.UPLOAD_DIR ?? "uploads", "source-cache.json");
}

async function main(): Promise<void> {
  const fileCache = process.argv.slice(2).includes("--file-cache");
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--force" && argument !== "--file-cache");
  if (unknownArguments.length > 0) {
    throw new TypeError(`Unknown argument: ${unknownArguments[0]}`);
  }

  let storage: SourceCacheStorage;
  if (fileCache) {
    storage = new JsonFileSourceCacheStorage(sourceCachePath());
  } else {
    const [{ guidelineRepository }, { sourceCacheRepository }] = await Promise.all([
      import("../src/server/repositories/guideline"),
      import("../src/server/repositories/source-cache"),
    ]);
    storage = await createRepositorySourceCacheStorage({
      sourceSlug: MYHEALTHFINDER_SOURCE_SLUG,
      sourceRepository: guidelineRepository,
      cacheRepository: sourceCacheRepository,
    });
  }
  const client = new MyHealthfinderClient();
  let succeeded = 0;
  let fallback = 0;
  let changed = 0;
  let failed = 0;

  for (const input of KNOWN_ANONYMOUS_PROFILES) {
    try {
      const result = await loadMyHealthfinderContent({
        input,
        client,
        storage,
        forceRefresh: true,
      });
      if (result.status === "cache_fallback") fallback += 1;
      else succeeded += 1;
      if (result.changeState === "changed_unreviewed") changed += 1;
    } catch {
      failed += 1;
    }
  }

  process.stdout.write(
    `MyHealthfinder sync: ${succeeded} live, ${fallback} cached fallback, ${changed} awaiting review, ${failed} failed.\n`,
  );
  if (failed > 0) process.exitCode = 1;
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown source sync failure.";
    process.stderr.write(`MyHealthfinder sync failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
