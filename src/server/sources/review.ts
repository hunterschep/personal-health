import { z } from "zod";

import type { SourceReviewDecision } from "./cache";

export type SourceReviewCommand = {
  sourceSlug: string;
  cacheKey: string;
  fileCache: boolean;
  decision: SourceReviewDecision;
};

export function sourceReviewAuditData(
  sourceId: string,
  decision: SourceReviewDecision["decision"],
) {
  return {
    action: "source.content_reviewed",
    entityType: "GuidelineSource",
    entityId: sourceId,
    metadataJson: { decision },
  } as const;
}

function requiredValue(arguments_: readonly string[], index: number, option: string): string {
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return value;
}

export function parseSourceReviewCommand(
  arguments_: readonly string[],
  now = new Date(),
): SourceReviewCommand {
  let sourceSlug: string | undefined;
  let cacheKey: string | undefined;
  let reviewer: string | undefined;
  let decision: SourceReviewDecision["decision"] | undefined;
  let note: string | null = null;
  let reviewedAt = now.toISOString();
  let fileCache = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--source":
        sourceSlug = requiredValue(arguments_, index, argument);
        index += 1;
        break;
      case "--cache-key":
        cacheKey = requiredValue(arguments_, index, argument);
        index += 1;
        break;
      case "--reviewer":
        reviewer = requiredValue(arguments_, index, argument);
        index += 1;
        break;
      case "--decision":
        decision = z
          .enum(["approved", "rejected", "acknowledged"])
          .parse(requiredValue(arguments_, index, argument));
        index += 1;
        break;
      case "--note":
        note = requiredValue(arguments_, index, argument);
        index += 1;
        break;
      case "--at":
        reviewedAt = z.iso.datetime().parse(requiredValue(arguments_, index, argument));
        index += 1;
        break;
      case "--file-cache":
        fileCache = true;
        break;
      default:
        throw new Error(`Unknown option: ${argument ?? ""}`);
    }
  }

  if (sourceSlug === undefined) throw new Error("--source is required.");
  if (cacheKey === undefined) throw new Error("--cache-key is required.");
  if (reviewer === undefined) throw new Error("--reviewer is required.");
  if (decision === undefined) throw new Error("--decision is required.");
  return {
    sourceSlug: z.string().trim().min(1).max(120).parse(sourceSlug),
    cacheKey: z.string().trim().min(1).max(255).parse(cacheKey),
    fileCache,
    decision: {
      decision,
      reviewer: z.string().trim().min(1).max(160).parse(reviewer),
      reviewedAt,
      note: note === null ? null : z.string().trim().min(1).max(1_000).parse(note),
    },
  };
}
