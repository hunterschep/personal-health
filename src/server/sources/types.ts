import { z } from "zod";

export const SOURCE_REGISTRY_VERSION = "2026-07-21" as const;

export const sourceTypeSchema = z.enum([
  "federal_recommendation",
  "federal_immunization",
  "consumer_content",
  "specialty_guideline",
  "app_authored_maintenance",
  "clinician_override",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const sourceLifecycleSchema = z.enum(["current", "future", "draft", "retired"]);
export type SourceLifecycle = z.infer<typeof sourceLifecycleSchema>;

export const evidenceClassSchema = z.enum([
  "uspstf_final",
  "uspstf_draft",
  "cdc_acip_operational",
  "cdc_public_health_recommendation",
  "hrsa_supported_guideline",
  "federal_consumer_content",
  "specialty_society_guideline",
  "app_authored_template",
  "personal_clinician_instruction",
]);
export type EvidenceClass = z.infer<typeof evidenceClassSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === "https:", {
  message: "Source URLs must use HTTPS.",
});

export const sourceAttributionSchema = z
  .object({
    required: z.boolean(),
    text: z.string().trim().min(1).nullable(),
    logoUrl: httpsUrlSchema.nullable(),
    destinationUrl: httpsUrlSchema.nullable(),
    contentMustRemainUnaltered: z.boolean(),
  })
  .strict()
  .superRefine((attribution, context) => {
    if (
      attribution.required &&
      (attribution.text === null || attribution.destinationUrl === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Required attribution needs text and a destination URL.",
      });
    }
  });
export type SourceAttribution = z.infer<typeof sourceAttributionSchema>;

export const relatedSourceUrlSchema = z
  .object({
    label: z.string().trim().min(1),
    url: httpsUrlSchema,
    role: z.enum(["supporting", "terms", "version_notice", "implementation_notes"]),
  })
  .strict();
export type RelatedSourceUrl = z.infer<typeof relatedSourceUrlSchema>;

export const sourceRegistryEntrySchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    organization: z.string().trim().min(1),
    title: z.string().trim().min(1),
    canonicalUrl: httpsUrlSchema,
    sourceType: sourceTypeSchema,
    evidenceClass: evidenceClassSchema,
    jurisdiction: z.literal("US"),
    publishedAt: isoDateSchema.nullable(),
    effectiveAt: isoDateSchema.nullable(),
    lastVerifiedAt: isoDateSchema,
    sourceVersion: z.string().trim().min(1),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    licenseOrTermsUrl: httpsUrlSchema.nullable(),
    attribution: sourceAttributionSchema,
    lifecycle: sourceLifecycleSchema,
    active: z.boolean(),
    serviceSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)),
    relatedUrls: z.array(relatedSourceUrlSchema),
    internalReviewerNote: z.string().trim().min(1),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.lifecycle === "draft" && source.active) {
      context.addIssue({ code: "custom", message: "Draft sources cannot be active." });
    }
    if (
      source.publishedAt !== null &&
      source.effectiveAt !== null &&
      source.effectiveAt < source.publishedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "A source effective date cannot precede its publication date.",
      });
    }
  });
export type SourceRegistryEntry = z.infer<typeof sourceRegistryEntrySchema>;

export type PublicSourceMetadata = Omit<SourceRegistryEntry, "internalReviewerNote">;

export const sourceFreshnessStateSchema = z.enum(["current", "review_due", "future", "inactive"]);
export type SourceFreshnessState = z.infer<typeof sourceFreshnessStateSchema>;

export const sourceChangeStateSchema = z.enum([
  "unchanged",
  "changed_unreviewed",
  "changed_reviewed",
]);
export type SourceChangeState = z.infer<typeof sourceChangeStateSchema>;

export type GuidelineRuleSourceReference = {
  stableKey: string;
  version: number;
  variantId?: string | undefined;
  sourceSlug: string;
  reviewStatus: "draft" | "reviewed" | "active" | "retired";
  effectiveFrom: string;
  effectiveTo: string | null;
  conflictGroup: string | null;
  baseline: boolean;
  importsSourceText: boolean;
};

export type SourceVerificationSeverity = "error" | "warning" | "info";

export type SourceVerificationIssue = {
  code: string;
  severity: SourceVerificationSeverity;
  message: string;
  sourceSlug?: string;
  ruleKey?: string;
};

export type SourceVerificationReport = {
  registryVersion: string;
  generatedAt: string;
  mode: "offline" | "live";
  sourceCount: number;
  activeSourceCount: number;
  ruleCount: number;
  issues: SourceVerificationIssue[];
  ok: boolean;
};
