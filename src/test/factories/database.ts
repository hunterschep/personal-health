import { Prisma } from "@/generated/prisma/client";

const FIXED_DATE = new Date("2026-07-21T12:00:00.000Z");
const FIXED_DAY = new Date("2026-07-21T00:00:00.000Z");

function stableUuid(code: number, seed: number): string {
  const suffix = String(code * 1_000_000 + seed).padStart(12, "0");
  return `90000000-0000-4000-8000-${suffix}`;
}

function build<T>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides };
}

export function createDatabaseFactory(seed = 1) {
  const ids = {
    user: stableUuid(1, seed),
    secondUser: stableUuid(2, seed),
    household: stableUuid(3, seed),
    profile: stableUuid(4, seed),
    service: stableUuid(5, seed),
    method: stableUuid(6, seed),
    source: stableUuid(7, seed),
    rule: stableUuid(8, seed),
    event: stableUuid(9, seed),
    override: stableUuid(10, seed),
    recommendation: stableUuid(11, seed),
    plannedAction: stableUuid(12, seed),
    medication: stableUuid(13, seed),
    importBatch: stableUuid(14, seed),
    document: stableUuid(15, seed),
  } as const;

  return {
    ids,

    user(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
      return build<Prisma.UserUncheckedCreateInput>(
        {
          id: ids.user,
          email: `synthetic-${seed}@example.invalid`,
          emailNormalized: `synthetic-${seed}@example.invalid`,
          passwordHash: "synthetic-password-hash",
          name: `Synthetic Person ${seed}`,
          sessionVersion: 1,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    account(overrides: Partial<Prisma.AccountUncheckedCreateInput> = {}) {
      return build<Prisma.AccountUncheckedCreateInput>(
        {
          id: stableUuid(16, seed),
          userId: ids.user,
          type: "credentials",
          provider: "credentials",
          providerAccountId: `synthetic-${seed}`,
        },
        overrides,
      );
    },

    session(overrides: Partial<Prisma.SessionUncheckedCreateInput> = {}) {
      return build<Prisma.SessionUncheckedCreateInput>(
        {
          id: stableUuid(17, seed),
          sessionToken: `synthetic-session-${seed}`,
          userId: ids.user,
          expires: new Date("2026-08-21T12:00:00.000Z"),
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    verificationToken(overrides: Partial<Prisma.VerificationTokenCreateInput> = {}) {
      return build<Prisma.VerificationTokenCreateInput>(
        {
          identifier: `synthetic-${seed}@example.invalid`,
          token: `synthetic-verification-${seed}`,
          expires: new Date("2026-07-22T12:00:00.000Z"),
        },
        overrides,
      );
    },

    authenticator(overrides: Partial<Prisma.AuthenticatorUncheckedCreateInput> = {}) {
      return build<Prisma.AuthenticatorUncheckedCreateInput>(
        {
          credentialID: `synthetic-credential-${seed}`,
          userId: ids.user,
          providerAccountId: `synthetic-provider-${seed}`,
          credentialPublicKey: "synthetic-public-key",
          counter: 0,
          credentialDeviceType: "singleDevice",
          credentialBackedUp: false,
          transports: null,
        },
        overrides,
      );
    },

    household(overrides: Partial<Prisma.HouseholdUncheckedCreateInput> = {}) {
      return build<Prisma.HouseholdUncheckedCreateInput>(
        {
          id: ids.household,
          name: `Synthetic Household ${seed}`,
          ownerUserId: ids.user,
          timezone: "America/Los_Angeles",
          countryCode: "US",
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    householdMember(overrides: Partial<Prisma.HouseholdMemberUncheckedCreateInput> = {}) {
      return build<Prisma.HouseholdMemberUncheckedCreateInput>(
        {
          id: stableUuid(18, seed),
          householdId: ids.household,
          userId: ids.user,
          role: "owner",
          joinedAt: FIXED_DATE,
          removedAt: null,
        },
        overrides,
      );
    },

    householdInvite(overrides: Partial<Prisma.HouseholdInviteUncheckedCreateInput> = {}) {
      return build<Prisma.HouseholdInviteUncheckedCreateInput>(
        {
          id: stableUuid(19, seed),
          householdId: ids.household,
          emailNormalized: `invite-${seed}@example.invalid`,
          role: "member",
          tokenHash: "a".repeat(64),
          expiresAt: new Date("2026-07-28T12:00:00.000Z"),
          invitedByUserId: ids.user,
          createdAt: FIXED_DATE,
        },
        overrides,
      );
    },

    profile(overrides: Partial<Prisma.ProfileUncheckedCreateInput> = {}) {
      return build<Prisma.ProfileUncheckedCreateInput>(
        {
          id: ids.profile,
          householdId: ids.household,
          ownerUserId: ids.user,
          createdByUserId: ids.user,
          displayName: `Synthetic Adult ${seed}`,
          relationshipLabel: "Self",
          dateOfBirth: new Date("1980-01-15T00:00:00.000Z"),
          sexAssignedAtBirth: "unknown",
          countryCode: "US",
          timezone: "America/Los_Angeles",
          carePlanMode: "evidence_based",
          visibility: "owner_only",
          claimedAt: FIXED_DATE,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    profileAccessGrant(overrides: Partial<Prisma.ProfileAccessGrantUncheckedCreateInput> = {}) {
      return build<Prisma.ProfileAccessGrantUncheckedCreateInput>(
        {
          id: stableUuid(20, seed),
          profileId: ids.profile,
          userId: ids.secondUser,
          permission: "view",
          grantedByUserId: ids.user,
          createdAt: FIXED_DATE,
        },
        overrides,
      );
    },

    profileClaimInvite(overrides: Partial<Prisma.ProfileClaimInviteUncheckedCreateInput> = {}) {
      return build<Prisma.ProfileClaimInviteUncheckedCreateInput>(
        {
          id: stableUuid(21, seed),
          profileId: ids.profile,
          emailNormalized: `claim-${seed}@example.invalid`,
          tokenHash: "b".repeat(64),
          expiresAt: new Date("2026-07-28T12:00:00.000Z"),
          createdByUserId: ids.user,
          createdAt: FIXED_DATE,
        },
        overrides,
      );
    },

    profileAnatomy(overrides: Partial<Prisma.ProfileAnatomyUncheckedCreateInput> = {}) {
      return build<Prisma.ProfileAnatomyUncheckedCreateInput>(
        {
          id: stableUuid(22, seed),
          profileId: ids.profile,
          anatomyKey: "cervix",
          state: "unknown",
          effectiveDate: null,
          note: null,
        },
        overrides,
      );
    },

    riskFactor(overrides: Partial<Prisma.RiskFactorUncheckedCreateInput> = {}) {
      return build<Prisma.RiskFactorUncheckedCreateInput>(
        {
          id: stableUuid(23, seed),
          profileId: ids.profile,
          type: "synthetic_risk",
          valueJson: { value: "unknown" },
          startedAt: null,
          endedAt: null,
          source: "user",
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    condition(overrides: Partial<Prisma.ConditionUncheckedCreateInput> = {}) {
      return build<Prisma.ConditionUncheckedCreateInput>(
        {
          id: stableUuid(24, seed),
          profileId: ids.profile,
          code: "synthetic-condition",
          displayName: "Synthetic condition",
          status: "history",
          diagnosedStart: null,
          diagnosedEnd: null,
          diagnosedDatePrecision: "unknown",
          note: null,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    familyHistory(overrides: Partial<Prisma.FamilyHistoryUncheckedCreateInput> = {}) {
      return build<Prisma.FamilyHistoryUncheckedCreateInput>(
        {
          id: stableUuid(25, seed),
          profileId: ids.profile,
          relationship: "synthetic-relative",
          conditionCode: "synthetic-condition",
          conditionDisplay: "Synthetic condition",
          ageAtDiagnosis: null,
          note: null,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    surgery(overrides: Partial<Prisma.SurgeryUncheckedCreateInput> = {}) {
      return build<Prisma.SurgeryUncheckedCreateInput>(
        {
          id: stableUuid(26, seed),
          profileId: ids.profile,
          code: "synthetic-procedure",
          displayName: "Synthetic procedure",
          performedStart: null,
          performedEnd: null,
          performedDatePrecision: "unknown",
          anatomyEffectsJson: { effects: [] },
          note: null,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    medication(overrides: Partial<Prisma.MedicationUncheckedCreateInput> = {}) {
      return build<Prisma.MedicationUncheckedCreateInput>(
        {
          id: ids.medication,
          profileId: ids.profile,
          name: "Synthetic medication",
          startedStart: null,
          startedEnd: null,
          startedDatePrecision: "unknown",
          endedStart: null,
          endedEnd: null,
          endedDatePrecision: null,
          status: "active",
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    service(overrides: Partial<Prisma.ServiceCatalogUncheckedCreateInput> = {}) {
      return build<Prisma.ServiceCatalogUncheckedCreateInput>(
        {
          id: ids.service,
          slug: `synthetic-service-${seed}`,
          name: "Synthetic service",
          shortName: "Synthetic",
          category: "custom",
          description: "Synthetic test-only service.",
          eventType: "synthetic_event",
          active: true,
          sortOrder: 1,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    serviceMethod(overrides: Partial<Prisma.ServiceMethodUncheckedCreateInput> = {}) {
      return build<Prisma.ServiceMethodUncheckedCreateInput>(
        {
          id: ids.method,
          serviceId: ids.service,
          slug: `synthetic-method-${seed}`,
          name: "Synthetic method",
          description: "Synthetic test-only method.",
          active: true,
          metadataJson: {},
        },
        overrides,
      );
    },

    guidelineSource(overrides: Partial<Prisma.GuidelineSourceUncheckedCreateInput> = {}) {
      return build<Prisma.GuidelineSourceUncheckedCreateInput>(
        {
          id: ids.source,
          slug: `synthetic-source-${seed}`,
          organization: "Synthetic Source Organization",
          title: "Synthetic source",
          canonicalUrl: "https://example.invalid/source",
          sourceType: "test_fixture",
          jurisdiction: "US",
          lastVerifiedAt: FIXED_DAY,
          active: true,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    guidelineRule(overrides: Partial<Prisma.GuidelineRuleUncheckedCreateInput> = {}) {
      return build<Prisma.GuidelineRuleUncheckedCreateInput>(
        {
          id: ids.rule,
          stableKey: `synthetic-rule-${seed}`,
          version: 1,
          serviceId: ids.service,
          variantId: "synthetic-baseline",
          conflictGroup: null,
          isBaseline: false,
          sourceId: ids.source,
          jurisdiction: "US",
          recommendationClass: "routine",
          appliesWhenJson: { op: "constant", value: true },
          scheduleJson: { kind: "one_time", dueOnEligibility: true },
          completionEventTypesJson: ["synthetic_event"],
          outcomeModifiersJson: [],
          consumerSummary: "Synthetic summary.",
          whyItMatters: "Synthetic explanation.",
          questionsForClinicianJson: [],
          limitationsJson: ["Test fixture only."],
          effectiveFrom: FIXED_DAY,
          reviewStatus: "active",
          reviewedBy: "Synthetic Reviewer",
          reviewedAt: FIXED_DAY,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    guidelineSelection(
      overrides: Partial<Prisma.ProfileGuidelineSelectionUncheckedCreateInput> = {},
    ) {
      return build<Prisma.ProfileGuidelineSelectionUncheckedCreateInput>(
        {
          id: stableUuid(27, seed),
          profileId: ids.profile,
          conflictGroup: "synthetic-conflict",
          variantId: "synthetic-baseline",
          selectedByUserId: ids.user,
          selectedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    careEvent(overrides: Partial<Prisma.CareEventUncheckedCreateInput> = {}) {
      return build<Prisma.CareEventUncheckedCreateInput>(
        {
          id: ids.event,
          profileId: ids.profile,
          serviceId: ids.service,
          methodId: ids.method,
          performedStart: FIXED_DAY,
          performedEnd: FIXED_DAY,
          datePrecision: "day",
          result: "normal",
          source: "user_memory",
          duplicateFingerprint: "c".repeat(64),
          createdByUserId: ids.user,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    clinicianOverride(overrides: Partial<Prisma.ClinicianOverrideUncheckedCreateInput> = {}) {
      return build<Prisma.ClinicianOverrideUncheckedCreateInput>(
        {
          id: ids.override,
          profileId: ids.profile,
          serviceId: ids.service,
          methodId: null,
          overrideType: "clinician_managed",
          nextDueStart: null,
          nextDueEnd: null,
          intervalJson: Prisma.DbNull,
          replacesGeneralGuideline: true,
          instructionReceivedDate: FIXED_DAY,
          active: true,
          createdByUserId: ids.user,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    recommendation(overrides: Partial<Prisma.RecommendationInstanceUncheckedCreateInput> = {}) {
      return build<Prisma.RecommendationInstanceUncheckedCreateInput>(
        {
          id: ids.recommendation,
          profileId: ids.profile,
          serviceId: ids.service,
          ruleId: ids.rule,
          ruleVersion: 1,
          variantId: "synthetic-baseline",
          status: "due_now",
          recommendationClass: "routine",
          dueStart: FIXED_DAY,
          dueEnd: FIXED_DAY,
          explanationJson: {
            tokens: [],
            limitations: [],
            generalGuidelineDueRange: null,
            personalDueRange: null,
            calculationTrace: [],
          },
          matchingFactsJson: [],
          calculationHash: "fnv1a-deadbeef",
          evaluatedAsOf: FIXED_DAY,
          retiredAt: null,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    plannedAction(overrides: Partial<Prisma.PlannedActionUncheckedCreateInput> = {}) {
      return build<Prisma.PlannedActionUncheckedCreateInput>(
        {
          id: ids.plannedAction,
          profileId: ids.profile,
          recommendationInstanceId: ids.recommendation,
          serviceId: ids.service,
          title: "Synthetic planned action",
          plannedMonth: new Date("2026-08-01T00:00:00.000Z"),
          timezone: "America/Los_Angeles",
          status: "planned",
          createdByUserId: ids.user,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    reminder(overrides: Partial<Prisma.ReminderUncheckedCreateInput> = {}) {
      return build<Prisma.ReminderUncheckedCreateInput>(
        {
          id: stableUuid(28, seed),
          profileId: ids.profile,
          plannedActionId: ids.plannedAction,
          channel: "in_app",
          remindAt: new Date("2026-08-01T16:00:00.000Z"),
          status: "pending",
          dedupeKey: `synthetic-reminder-${seed}`,
          sentAt: null,
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    document(overrides: Partial<Prisma.DocumentUncheckedCreateInput> = {}) {
      return build<Prisma.DocumentUncheckedCreateInput>(
        {
          id: ids.document,
          householdId: ids.household,
          profileId: ids.profile,
          storageKey: `synthetic/${seed}/document.pdf`,
          originalFilename: "synthetic-document.pdf",
          safeFilename: "synthetic-document.pdf",
          mimeType: "application/pdf",
          sizeBytes: 128n,
          sha256: "e".repeat(64),
          uploadedByUserId: ids.user,
          createdAt: FIXED_DATE,
          deletedAt: null,
        },
        overrides,
      );
    },

    documentLink(overrides: Partial<Prisma.DocumentLinkUncheckedCreateInput> = {}) {
      return build<Prisma.DocumentLinkUncheckedCreateInput>(
        {
          id: stableUuid(29, seed),
          documentId: ids.document,
          careEventId: ids.event,
          medicationId: null,
          clinicianOverrideId: null,
          label: "Synthetic record",
          createdAt: FIXED_DATE,
        },
        overrides,
      );
    },

    auditLog(overrides: Partial<Prisma.AuditLogUncheckedCreateInput> = {}) {
      return build<Prisma.AuditLogUncheckedCreateInput>(
        {
          id: stableUuid(30, seed),
          householdId: ids.household,
          profileId: ids.profile,
          actorUserId: ids.user,
          action: "synthetic.created",
          entityType: "synthetic",
          entityId: stableUuid(31, seed),
          metadataJson: {},
          createdAt: FIXED_DATE,
        },
        overrides,
      );
    },

    sourceSyncLog(overrides: Partial<Prisma.SourceSyncLogUncheckedCreateInput> = {}) {
      return build<Prisma.SourceSyncLogUncheckedCreateInput>(
        {
          id: stableUuid(32, seed),
          sourceId: ids.source,
          startedAt: FIXED_DATE,
          finishedAt: FIXED_DATE,
          status: "unchanged",
          httpStatus: 200,
          contentHash: "f".repeat(64),
          changed: false,
          message: null,
        },
        overrides,
      );
    },

    externalContentCache(overrides: Partial<Prisma.ExternalContentCacheUncheckedCreateInput> = {}) {
      return build<Prisma.ExternalContentCacheUncheckedCreateInput>(
        {
          id: stableUuid(33, seed),
          sourceId: ids.source,
          cacheKey: `synthetic-cache-${seed}`,
          payloadJson: { synthetic: true },
          contentHash: "f".repeat(64),
          fetchedAt: FIXED_DATE,
          expiresAt: new Date("2026-07-22T12:00:00.000Z"),
          lastSuccessfulAt: FIXED_DATE,
        },
        overrides,
      );
    },

    importBatch(overrides: Partial<Prisma.ImportBatchUncheckedCreateInput> = {}) {
      return build<Prisma.ImportBatchUncheckedCreateInput>(
        {
          id: ids.importBatch,
          profileId: ids.profile,
          uploadedByUserId: ids.user,
          filename: "synthetic-import.csv",
          status: "ready",
          rowCount: 1,
          validCount: 1,
          errorCount: 0,
          commitTokenHash: "1".repeat(64),
          createdAt: FIXED_DATE,
          committedAt: null,
        },
        overrides,
      );
    },

    onboardingDraft(overrides: Partial<Prisma.OnboardingDraftUncheckedCreateInput> = {}) {
      return build<Prisma.OnboardingDraftUncheckedCreateInput>(
        {
          userId: ids.user,
          step: 2,
          dataJson: { synthetic: true },
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
        },
        overrides,
      );
    },

    profileHistoryState(
      overrides: Partial<Prisma.ProfileServiceHistoryStateUncheckedCreateInput> = {},
    ) {
      return build<Prisma.ProfileServiceHistoryStateUncheckedCreateInput>(
        {
          id: stableUuid(34, seed),
          profileId: ids.profile,
          serviceId: ids.service,
          state: "unsure",
          recordedAt: FIXED_DATE,
          recordedByUserId: ids.user,
        },
        overrides,
      );
    },
  };
}

export type DatabaseFactory = ReturnType<typeof createDatabaseFactory>;
