import type { DatabaseClient } from "@/server/db";
import { createGuidelineRepository } from "@/server/repositories/guideline";
import { SOURCE_REGISTRY, toGuidelineSourceSeed } from "@/server/sources/registry";

function dateOnly(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

export async function seedSources(database: DatabaseClient): Promise<number> {
  const repository = createGuidelineRepository(database);

  for (const source of SOURCE_REGISTRY) {
    const seed = toGuidelineSourceSeed(source);
    await repository.upsertSource({
      ...seed,
      publishedAt: dateOnly(seed.publishedAt),
      effectiveAt: dateOnly(seed.effectiveAt),
      lastVerifiedAt: dateOnly(seed.lastVerifiedAt) as Date,
    });
  }

  return SOURCE_REGISTRY.length;
}
