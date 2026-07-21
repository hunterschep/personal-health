-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "SexAssignedAtBirth" AS ENUM ('female', 'male', 'intersex', 'unknown', 'prefer_not_to_answer');

-- CreateEnum
CREATE TYPE "CarePlanMode" AS ENUM ('evidence_based', 'extra_attentive', 'clinician_plan');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('owner_only', 'selected_members', 'household');

-- CreateEnum
CREATE TYPE "ProfilePermission" AS ENUM ('view', 'edit', 'manage');

-- CreateEnum
CREATE TYPE "AnatomyKey" AS ENUM ('cervix', 'breast_tissue', 'prostate', 'uterus', 'ovaries');

-- CreateEnum
CREATE TYPE "AnatomyState" AS ENUM ('present', 'absent', 'unknown', 'prefer_not_to_answer');

-- CreateEnum
CREATE TYPE "HealthContextSource" AS ENUM ('user', 'clinician', 'medical_record', 'csv_import');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('active', 'resolved', 'history');

-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('cancer_screening', 'cardiometabolic', 'infectious_disease', 'immunization', 'bone_joint', 'vascular', 'mental_behavioral', 'sensory_function', 'routine_maintenance', 'medication_monitoring', 'custom');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('day', 'month', 'year', 'unknown');

-- CreateEnum
CREATE TYPE "GuidelineReviewStatus" AS ENUM ('draft', 'reviewed', 'active', 'retired');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('future', 'up_to_date', 'due_this_year', 'due_soon', 'due_now', 'overdue', 'unknown_history', 'needs_date_confirmation', 'discuss_with_clinician', 'clinician_managed', 'not_routinely_recommended', 'not_applicable', 'completed_once');

-- CreateEnum
CREATE TYPE "RecommendationClass" AS ENUM ('routine', 'shared-decision', 'selective', 'insufficient-evidence', 'not-recommended', 'custom-maintenance');

-- CreateEnum
CREATE TYPE "CareEventResult" AS ENUM ('normal', 'abnormal', 'inconclusive', 'unknown', 'not_applicable');

-- CreateEnum
CREATE TYPE "CareEventSource" AS ENUM ('user_memory', 'medical_record', 'clinician', 'pharmacy', 'csv_import');

-- CreateEnum
CREATE TYPE "ClinicianOverrideType" AS ENUM ('exact_next_date', 'recurring_interval', 'no_longer_needed', 'clinician_managed');

-- CreateEnum
CREATE TYPE "PlannedActionStatus" AS ENUM ('planned', 'scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('pending', 'sent', 'dismissed', 'cancelled');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('previewing', 'ready', 'committing', 'committed', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "emailNormalized" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255),
    "name" VARCHAR(100),
    "email_verified_at" TIMESTAMPTZ(3),
    "image" VARCHAR(2048),
    "lastLoginAt" TIMESTAMPTZ(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(100),
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "sessionToken" VARCHAR(255) NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" VARCHAR(254) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" VARCHAR(32) NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'US',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "HouseholdRole" NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(3),

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "emailNormalized" VARCHAR(254) NOT NULL,
    "role" "HouseholdRole" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "invitedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "ownerUserId" UUID,
    "createdByUserId" UUID NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "relationshipLabel" VARCHAR(50) NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "sexAssignedAtBirth" "SexAssignedAtBirth" NOT NULL,
    "genderIdentity" VARCHAR(120),
    "countryCode" CHAR(2) NOT NULL DEFAULT 'US',
    "timezone" VARCHAR(80) NOT NULL,
    "carePlanMode" "CarePlanMode" NOT NULL DEFAULT 'evidence_based',
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'owner_only',
    "claimedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileAccessGrant" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permission" "ProfilePermission" NOT NULL,
    "grantedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileClaimInvite" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "emailNormalized" VARCHAR(254) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileClaimInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileAnatomy" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "anatomyKey" "AnatomyKey" NOT NULL,
    "state" "AnatomyState" NOT NULL,
    "effectiveDate" DATE,
    "note" VARCHAR(500),

    CONSTRAINT "ProfileAnatomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFactor" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "valueJson" JSONB NOT NULL,
    "startedAt" DATE,
    "endedAt" DATE,
    "source" "HealthContextSource" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RiskFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "status" "ConditionStatus" NOT NULL,
    "diagnosedStart" DATE,
    "diagnosedEnd" DATE,
    "diagnosedDatePrecision" "DatePrecision" NOT NULL DEFAULT 'unknown',
    "note" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyHistory" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "relationship" VARCHAR(80) NOT NULL,
    "conditionCode" VARCHAR(80) NOT NULL,
    "conditionDisplay" VARCHAR(160) NOT NULL,
    "ageAtDiagnosis" INTEGER,
    "note" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FamilyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Surgery" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "performedStart" DATE,
    "performedEnd" DATE,
    "performedDatePrecision" "DatePrecision" NOT NULL DEFAULT 'unknown',
    "anatomyEffectsJson" JSONB,
    "note" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Surgery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "dose" VARCHAR(120),
    "frequency" VARCHAR(120),
    "prescriber" VARCHAR(160),
    "reason" VARCHAR(500),
    "startedStart" DATE,
    "startedEnd" DATE,
    "startedDatePrecision" "DatePrecision" NOT NULL DEFAULT 'unknown',
    "endedStart" DATE,
    "endedEnd" DATE,
    "endedDatePrecision" "DatePrecision",
    "status" "MedicationStatus" NOT NULL DEFAULT 'active',
    "monitoringInstructions" VARCHAR(2000),
    "nextReviewDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalog" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "shortName" VARCHAR(100) NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "bodySystem" VARCHAR(100),
    "eventType" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMethod" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,

    CONSTRAINT "ServiceMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineSource" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "organization" VARCHAR(160) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "canonicalUrl" VARCHAR(2048) NOT NULL,
    "sourceType" VARCHAR(80) NOT NULL,
    "jurisdiction" VARCHAR(20) NOT NULL DEFAULT 'US',
    "publishedAt" DATE,
    "effectiveAt" DATE,
    "lastVerifiedAt" DATE NOT NULL,
    "contentHash" CHAR(64),
    "attributionText" TEXT,
    "licenseOrTermsUrl" VARCHAR(2048),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GuidelineSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineRule" (
    "id" UUID NOT NULL,
    "stableKey" VARCHAR(160) NOT NULL,
    "version" INTEGER NOT NULL,
    "serviceId" UUID NOT NULL,
    "variantId" VARCHAR(100) NOT NULL,
    "conflictGroup" VARCHAR(100),
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" UUID NOT NULL,
    "jurisdiction" VARCHAR(20) NOT NULL DEFAULT 'US',
    "evidenceGrade" VARCHAR(40),
    "recommendationClass" "RecommendationClass" NOT NULL,
    "appliesWhenJson" JSONB NOT NULL,
    "excludesWhenJson" JSONB,
    "stopWhenJson" JSONB,
    "scheduleJson" JSONB NOT NULL,
    "completionEventTypesJson" JSONB NOT NULL,
    "allowedMethodsJson" JSONB,
    "outcomeModifiersJson" JSONB,
    "consumerSummary" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "questionsForClinicianJson" JSONB NOT NULL,
    "limitationsJson" JSONB NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "reviewStatus" "GuidelineReviewStatus" NOT NULL,
    "reviewedBy" VARCHAR(160) NOT NULL,
    "reviewedAt" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GuidelineRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileGuidelineSelection" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "conflictGroup" VARCHAR(100) NOT NULL,
    "variantId" VARCHAR(100) NOT NULL,
    "selectedByUserId" UUID NOT NULL,
    "selectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileGuidelineSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareEvent" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "methodId" UUID,
    "performedStart" DATE,
    "performedEnd" DATE,
    "datePrecision" "DatePrecision" NOT NULL,
    "result" "CareEventResult" NOT NULL,
    "providerName" VARCHAR(120),
    "locationName" VARCHAR(160),
    "notes" VARCHAR(2000),
    "source" "CareEventSource" NOT NULL,
    "importBatchId" UUID,
    "duplicateFingerprint" CHAR(64) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianOverride" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "methodId" UUID,
    "overrideType" "ClinicianOverrideType" NOT NULL,
    "nextDueStart" DATE,
    "nextDueEnd" DATE,
    "intervalJson" JSONB,
    "replacesGeneralGuideline" BOOLEAN NOT NULL DEFAULT true,
    "clinicianName" VARCHAR(160),
    "practiceName" VARCHAR(160),
    "instructionReceivedDate" DATE NOT NULL,
    "reason" VARCHAR(1000),
    "reviewDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClinicianOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationInstance" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "variantId" VARCHAR(100) NOT NULL,
    "conflictGroup" VARCHAR(100),
    "status" "RecommendationStatus" NOT NULL,
    "recommendationClass" "RecommendationClass" NOT NULL,
    "dueStart" DATE,
    "dueEnd" DATE,
    "lastQualifyingEventId" UUID,
    "activeOverrideId" UUID,
    "explanationJson" JSONB NOT NULL,
    "matchingFactsJson" JSONB NOT NULL,
    "calculationHash" CHAR(64) NOT NULL,
    "evaluatedAsOf" DATE NOT NULL,
    "retiredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecommendationInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedAction" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "recommendationInstanceId" UUID,
    "serviceId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "plannedMonth" DATE,
    "appointmentStart" TIMESTAMPTZ(3),
    "appointmentEnd" TIMESTAMPTZ(3),
    "timezone" VARCHAR(80) NOT NULL,
    "location" VARCHAR(200),
    "notes" VARCHAR(2000),
    "status" "PlannedActionStatus" NOT NULL DEFAULT 'planned',
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlannedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "plannedActionId" UUID,
    "recommendationInstanceId" UUID,
    "channel" "ReminderChannel" NOT NULL,
    "remindAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'pending',
    "dedupeKey" VARCHAR(160) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "safeFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "careEventId" UUID,
    "medicationId" UUID,
    "clinicianOverrideId" UUID,
    "label" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "householdId" UUID,
    "profileId" UUID,
    "actorUserId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "metadataJson" JSONB NOT NULL,
    "ipHash" CHAR(64),
    "userAgentFamily" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSyncLog" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "status" VARCHAR(40) NOT NULL,
    "httpStatus" INTEGER,
    "contentHash" CHAR(64),
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "message" VARCHAR(1000),

    CONSTRAINT "SourceSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalContentCache" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "cacheKey" VARCHAR(255) NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSuccessfulAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExternalContentCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "status" "ImportBatchStatus" NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "validCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "commitTokenHash" CHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_expires_idx" ON "Session"("userId", "expires");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE INDEX "Household_ownerUserId_deletedAt_idx" ON "Household"("ownerUserId", "deletedAt");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_removedAt_idx" ON "HouseholdMember"("householdId", "removedAt");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_removedAt_idx" ON "HouseholdMember"("userId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "HouseholdInvite_householdId_emailNormalized_idx" ON "HouseholdInvite"("householdId", "emailNormalized");

-- CreateIndex
CREATE INDEX "HouseholdInvite_emailNormalized_expiresAt_idx" ON "HouseholdInvite"("emailNormalized", "expiresAt");

-- CreateIndex
CREATE INDEX "Profile_householdId_deletedAt_idx" ON "Profile"("householdId", "deletedAt");

-- CreateIndex
CREATE INDEX "Profile_ownerUserId_deletedAt_idx" ON "Profile"("ownerUserId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProfileAccessGrant_userId_permission_idx" ON "ProfileAccessGrant"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAccessGrant_profileId_userId_key" ON "ProfileAccessGrant"("profileId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileClaimInvite_tokenHash_key" ON "ProfileClaimInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ProfileClaimInvite_profileId_expiresAt_idx" ON "ProfileClaimInvite"("profileId", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileClaimInvite_emailNormalized_expiresAt_idx" ON "ProfileClaimInvite"("emailNormalized", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAnatomy_profileId_anatomyKey_key" ON "ProfileAnatomy"("profileId", "anatomyKey");

-- CreateIndex
CREATE INDEX "RiskFactor_profileId_type_deletedAt_idx" ON "RiskFactor"("profileId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "Condition_profileId_code_status_deletedAt_idx" ON "Condition"("profileId", "code", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "FamilyHistory_profileId_conditionCode_deletedAt_idx" ON "FamilyHistory"("profileId", "conditionCode", "deletedAt");

-- CreateIndex
CREATE INDEX "Surgery_profileId_code_deletedAt_idx" ON "Surgery"("profileId", "code", "deletedAt");

-- CreateIndex
CREATE INDEX "Medication_profileId_status_deletedAt_idx" ON "Medication"("profileId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Medication_profileId_nextReviewDate_idx" ON "Medication"("profileId", "nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalog_slug_key" ON "ServiceCatalog"("slug");

-- CreateIndex
CREATE INDEX "ServiceCatalog_category_active_sortOrder_idx" ON "ServiceCatalog"("category", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "ServiceMethod_serviceId_active_idx" ON "ServiceMethod"("serviceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMethod_serviceId_slug_key" ON "ServiceMethod"("serviceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "GuidelineSource_slug_key" ON "GuidelineSource"("slug");

-- CreateIndex
CREATE INDEX "GuidelineSource_active_lastVerifiedAt_idx" ON "GuidelineSource"("active", "lastVerifiedAt");

-- CreateIndex
CREATE INDEX "GuidelineSource_sourceType_jurisdiction_idx" ON "GuidelineSource"("sourceType", "jurisdiction");

-- CreateIndex
CREATE INDEX "GuidelineRule_serviceId_reviewStatus_effectiveFrom_effectiv_idx" ON "GuidelineRule"("serviceId", "reviewStatus", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "GuidelineRule_sourceId_reviewStatus_idx" ON "GuidelineRule"("sourceId", "reviewStatus");

-- CreateIndex
CREATE INDEX "GuidelineRule_conflictGroup_reviewStatus_idx" ON "GuidelineRule"("conflictGroup", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GuidelineRule_stableKey_version_key" ON "GuidelineRule"("stableKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileGuidelineSelection_profileId_conflictGroup_key" ON "ProfileGuidelineSelection"("profileId", "conflictGroup");

-- CreateIndex
CREATE INDEX "CareEvent_profileId_serviceId_performedStart_deletedAt_idx" ON "CareEvent"("profileId", "serviceId", "performedStart" DESC, "deletedAt");

-- CreateIndex
CREATE INDEX "CareEvent_profileId_duplicateFingerprint_deletedAt_idx" ON "CareEvent"("profileId", "duplicateFingerprint", "deletedAt");

-- CreateIndex
CREATE INDEX "CareEvent_importBatchId_idx" ON "CareEvent"("importBatchId");

-- CreateIndex
CREATE INDEX "ClinicianOverride_profileId_serviceId_active_idx" ON "ClinicianOverride"("profileId", "serviceId", "active");

-- CreateIndex
CREATE INDEX "ClinicianOverride_reviewDate_active_idx" ON "ClinicianOverride"("reviewDate", "active");

-- CreateIndex
CREATE INDEX "RecommendationInstance_profileId_status_dueStart_retiredAt_idx" ON "RecommendationInstance"("profileId", "status", "dueStart", "retiredAt");

-- CreateIndex
CREATE INDEX "RecommendationInstance_profileId_ruleId_retiredAt_idx" ON "RecommendationInstance"("profileId", "ruleId", "retiredAt");

-- CreateIndex
CREATE INDEX "RecommendationInstance_calculationHash_idx" ON "RecommendationInstance"("calculationHash");

-- CreateIndex
CREATE INDEX "PlannedAction_profileId_status_plannedMonth_idx" ON "PlannedAction"("profileId", "status", "plannedMonth");

-- CreateIndex
CREATE INDEX "PlannedAction_profileId_appointmentStart_idx" ON "PlannedAction"("profileId", "appointmentStart");

-- CreateIndex
CREATE INDEX "Reminder_status_remindAt_idx" ON "Reminder"("status", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_profileId_status_remindAt_idx" ON "Reminder"("profileId", "status", "remindAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_profileId_channel_dedupeKey_key" ON "Reminder"("profileId", "channel", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_profileId_createdAt_deletedAt_idx" ON "Document"("profileId", "createdAt" DESC, "deletedAt");

-- CreateIndex
CREATE INDEX "Document_householdId_createdAt_idx" ON "Document"("householdId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_sha256_idx" ON "Document"("sha256");

-- CreateIndex
CREATE INDEX "DocumentLink_documentId_idx" ON "DocumentLink"("documentId");

-- CreateIndex
CREATE INDEX "DocumentLink_careEventId_idx" ON "DocumentLink"("careEventId");

-- CreateIndex
CREATE INDEX "DocumentLink_medicationId_idx" ON "DocumentLink"("medicationId");

-- CreateIndex
CREATE INDEX "DocumentLink_clinicianOverrideId_idx" ON "DocumentLink"("clinicianOverrideId");

-- CreateIndex
CREATE INDEX "AuditLog_householdId_createdAt_idx" ON "AuditLog"("householdId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_profileId_createdAt_idx" ON "AuditLog"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SourceSyncLog_sourceId_startedAt_idx" ON "SourceSyncLog"("sourceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "SourceSyncLog_status_startedAt_idx" ON "SourceSyncLog"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "ExternalContentCache_expiresAt_idx" ON "ExternalContentCache"("expiresAt");

-- CreateIndex
CREATE INDEX "ExternalContentCache_sourceId_lastSuccessfulAt_idx" ON "ExternalContentCache"("sourceId", "lastSuccessfulAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalContentCache_sourceId_cacheKey_key" ON "ExternalContentCache"("sourceId", "cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_commitTokenHash_key" ON "ImportBatch"("commitTokenHash");

-- CreateIndex
CREATE INDEX "ImportBatch_profileId_createdAt_idx" ON "ImportBatch"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportBatch_uploadedByUserId_status_idx" ON "ImportBatch"("uploadedByUserId", "status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileAccessGrant" ADD CONSTRAINT "ProfileAccessGrant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileAccessGrant" ADD CONSTRAINT "ProfileAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileAccessGrant" ADD CONSTRAINT "ProfileAccessGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClaimInvite" ADD CONSTRAINT "ProfileClaimInvite_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClaimInvite" ADD CONSTRAINT "ProfileClaimInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileAnatomy" ADD CONSTRAINT "ProfileAnatomy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyHistory" ADD CONSTRAINT "FamilyHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMethod" ADD CONSTRAINT "ServiceMethod_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidelineRule" ADD CONSTRAINT "GuidelineRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidelineRule" ADD CONSTRAINT "GuidelineRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GuidelineSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileGuidelineSelection" ADD CONSTRAINT "ProfileGuidelineSelection_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileGuidelineSelection" ADD CONSTRAINT "ProfileGuidelineSelection_selectedByUserId_fkey" FOREIGN KEY ("selectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "ServiceMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianOverride" ADD CONSTRAINT "ClinicianOverride_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianOverride" ADD CONSTRAINT "ClinicianOverride_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianOverride" ADD CONSTRAINT "ClinicianOverride_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "ServiceMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianOverride" ADD CONSTRAINT "ClinicianOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInstance" ADD CONSTRAINT "RecommendationInstance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInstance" ADD CONSTRAINT "RecommendationInstance_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInstance" ADD CONSTRAINT "RecommendationInstance_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "GuidelineRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInstance" ADD CONSTRAINT "RecommendationInstance_lastQualifyingEventId_fkey" FOREIGN KEY ("lastQualifyingEventId") REFERENCES "CareEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInstance" ADD CONSTRAINT "RecommendationInstance_activeOverrideId_fkey" FOREIGN KEY ("activeOverrideId") REFERENCES "ClinicianOverride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAction" ADD CONSTRAINT "PlannedAction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAction" ADD CONSTRAINT "PlannedAction_recommendationInstanceId_fkey" FOREIGN KEY ("recommendationInstanceId") REFERENCES "RecommendationInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAction" ADD CONSTRAINT "PlannedAction_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAction" ADD CONSTRAINT "PlannedAction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_plannedActionId_fkey" FOREIGN KEY ("plannedActionId") REFERENCES "PlannedAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_recommendationInstanceId_fkey" FOREIGN KEY ("recommendationInstanceId") REFERENCES "RecommendationInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_careEventId_fkey" FOREIGN KEY ("careEventId") REFERENCES "CareEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_clinicianOverrideId_fkey" FOREIGN KEY ("clinicianOverrideId") REFERENCES "ClinicianOverride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncLog" ADD CONSTRAINT "SourceSyncLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GuidelineSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalContentCache" ADD CONSTRAINT "ExternalContentCache_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GuidelineSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL-only invariants that Prisma's schema language cannot express.

-- A removed membership remains as history, while a person can have only one
-- current membership in a household.
CREATE UNIQUE INDEX "HouseholdMember_active_household_user_key"
ON "HouseholdMember" ("householdId", "userId")
WHERE "removedAt" IS NULL;

-- Recommendation history is retained; only one current snapshot may exist for
-- a profile and immutable rule version.
CREATE UNIQUE INDEX "RecommendationInstance_active_profile_rule_key"
ON "RecommendationInstance" ("profileId", "ruleId")
WHERE "retiredAt" IS NULL;

-- A current conflict group has one federal/default baseline.
CREATE UNIQUE INDEX "GuidelineRule_active_conflict_baseline_key"
ON "GuidelineRule" ("conflictGroup")
WHERE "isBaseline" = true
  AND "reviewStatus" = 'active'
  AND "effectiveTo" IS NULL
  AND "conflictGroup" IS NOT NULL;

ALTER TABLE "User"
  ADD CONSTRAINT "User_session_version_positive" CHECK ("sessionVersion" > 0),
  ADD CONSTRAINT "User_email_normalized" CHECK (
    "emailNormalized" = lower(btrim("emailNormalized"))
    AND length("emailNormalized") > 0
  );

ALTER TABLE "Household"
  ADD CONSTRAINT "Household_country_code_format" CHECK ("countryCode" ~ '^[A-Z]{2}$');

ALTER TABLE "HouseholdInvite"
  ADD CONSTRAINT "HouseholdInvite_expiry_after_creation" CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "HouseholdInvite_single_terminal_state" CHECK (
    num_nonnulls("acceptedAt", "revokedAt") <= 1
  );

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_country_code_format" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "Profile_claim_state" CHECK (
    ("ownerUserId" IS NULL AND "claimedAt" IS NULL)
    OR "ownerUserId" IS NOT NULL
  );

ALTER TABLE "ProfileClaimInvite"
  ADD CONSTRAINT "ProfileClaimInvite_expiry_after_creation" CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "ProfileClaimInvite_single_terminal_state" CHECK (
    num_nonnulls("acceptedAt", "revokedAt") <= 1
  );

ALTER TABLE "RiskFactor"
  ADD CONSTRAINT "RiskFactor_date_range_order" CHECK (
    "startedAt" IS NULL OR "endedAt" IS NULL OR "startedAt" <= "endedAt"
  );

ALTER TABLE "Condition"
  ADD CONSTRAINT "Condition_diagnosed_date_range" CHECK (
    ("diagnosedDatePrecision" = 'unknown' AND "diagnosedStart" IS NULL AND "diagnosedEnd" IS NULL)
    OR
    ("diagnosedDatePrecision" <> 'unknown'
      AND "diagnosedStart" IS NOT NULL
      AND "diagnosedEnd" IS NOT NULL
      AND "diagnosedStart" <= "diagnosedEnd"
      AND ("diagnosedDatePrecision" <> 'day' OR "diagnosedStart" = "diagnosedEnd"))
  );

ALTER TABLE "FamilyHistory"
  ADD CONSTRAINT "FamilyHistory_age_at_diagnosis_range" CHECK (
    "ageAtDiagnosis" IS NULL OR "ageAtDiagnosis" BETWEEN 0 AND 130
  );

ALTER TABLE "Surgery"
  ADD CONSTRAINT "Surgery_performed_date_range" CHECK (
    ("performedDatePrecision" = 'unknown' AND "performedStart" IS NULL AND "performedEnd" IS NULL)
    OR
    ("performedDatePrecision" <> 'unknown'
      AND "performedStart" IS NOT NULL
      AND "performedEnd" IS NOT NULL
      AND "performedStart" <= "performedEnd"
      AND ("performedDatePrecision" <> 'day' OR "performedStart" = "performedEnd"))
  ),
  ADD CONSTRAINT "Surgery_anatomy_effects_object" CHECK (
    "anatomyEffectsJson" IS NULL OR jsonb_typeof("anatomyEffectsJson") = 'object'
  );

ALTER TABLE "Medication"
  ADD CONSTRAINT "Medication_started_date_range" CHECK (
    ("startedDatePrecision" = 'unknown' AND "startedStart" IS NULL AND "startedEnd" IS NULL)
    OR
    ("startedDatePrecision" <> 'unknown'
      AND "startedStart" IS NOT NULL
      AND "startedEnd" IS NOT NULL
      AND "startedStart" <= "startedEnd"
      AND ("startedDatePrecision" <> 'day' OR "startedStart" = "startedEnd"))
  ),
  ADD CONSTRAINT "Medication_ended_date_range" CHECK (
    ("endedDatePrecision" IS NULL AND "endedStart" IS NULL AND "endedEnd" IS NULL)
    OR
    ("endedDatePrecision" = 'unknown' AND "endedStart" IS NULL AND "endedEnd" IS NULL)
    OR
    ("endedDatePrecision" IS NOT NULL
      AND "endedDatePrecision" <> 'unknown'
      AND "endedStart" IS NOT NULL
      AND "endedEnd" IS NOT NULL
      AND "endedStart" <= "endedEnd"
      AND ("endedDatePrecision" <> 'day' OR "endedStart" = "endedEnd"))
  );

ALTER TABLE "ServiceCatalog"
  ADD CONSTRAINT "ServiceCatalog_sort_order_nonnegative" CHECK ("sortOrder" >= 0);

ALTER TABLE "GuidelineRule"
  ADD CONSTRAINT "GuidelineRule_positive_version" CHECK ("version" > 0),
  ADD CONSTRAINT "GuidelineRule_effective_date_order" CHECK (
    "effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"
  ),
  ADD CONSTRAINT "GuidelineRule_baseline_has_conflict_group" CHECK (
    NOT "isBaseline" OR "conflictGroup" IS NOT NULL
  ),
  ADD CONSTRAINT "GuidelineRule_json_shapes" CHECK (
    jsonb_typeof("appliesWhenJson") = 'object'
    AND jsonb_typeof("scheduleJson") = 'object'
    AND jsonb_typeof("completionEventTypesJson") = 'array'
    AND jsonb_array_length("completionEventTypesJson") > 0
    AND jsonb_typeof("questionsForClinicianJson") = 'array'
    AND jsonb_typeof("limitationsJson") = 'array'
    AND ("excludesWhenJson" IS NULL OR jsonb_typeof("excludesWhenJson") = 'object')
    AND ("stopWhenJson" IS NULL OR jsonb_typeof("stopWhenJson") = 'object')
    AND ("allowedMethodsJson" IS NULL OR jsonb_typeof("allowedMethodsJson") = 'array')
    AND ("outcomeModifiersJson" IS NULL OR jsonb_typeof("outcomeModifiersJson") = 'array')
  );

ALTER TABLE "CareEvent"
  ADD CONSTRAINT "CareEvent_performed_date_range" CHECK (
    ("datePrecision" = 'unknown' AND "performedStart" IS NULL AND "performedEnd" IS NULL)
    OR
    ("datePrecision" <> 'unknown'
      AND "performedStart" IS NOT NULL
      AND "performedEnd" IS NOT NULL
      AND "performedStart" <= "performedEnd"
      AND ("datePrecision" <> 'day' OR "performedStart" = "performedEnd"))
  );

ALTER TABLE "ClinicianOverride"
  ADD CONSTRAINT "ClinicianOverride_due_date_order" CHECK (
    "nextDueStart" IS NULL OR "nextDueEnd" IS NULL OR "nextDueStart" <= "nextDueEnd"
  ),
  ADD CONSTRAINT "ClinicianOverride_fields_match_type" CHECK (
    ("overrideType" = 'exact_next_date'
      AND "nextDueStart" IS NOT NULL
      AND "nextDueEnd" IS NOT NULL
      AND "intervalJson" IS NULL)
    OR
    ("overrideType" = 'recurring_interval'
      AND "intervalJson" IS NOT NULL
      AND jsonb_typeof("intervalJson") = 'object'
      AND num_nonnulls("nextDueStart", "nextDueEnd") IN (0, 2))
    OR
    ("overrideType" IN ('no_longer_needed', 'clinician_managed')
      AND "nextDueStart" IS NULL
      AND "nextDueEnd" IS NULL
      AND "intervalJson" IS NULL)
  );

ALTER TABLE "RecommendationInstance"
  ADD CONSTRAINT "RecommendationInstance_rule_version_positive" CHECK ("ruleVersion" > 0),
  ADD CONSTRAINT "RecommendationInstance_due_date_range" CHECK (
    ("dueStart" IS NULL AND "dueEnd" IS NULL)
    OR ("dueStart" IS NOT NULL AND "dueEnd" IS NOT NULL AND "dueStart" <= "dueEnd")
  ),
  ADD CONSTRAINT "RecommendationInstance_explanation_array" CHECK (
    jsonb_typeof("explanationJson") = 'array'
    AND jsonb_typeof("matchingFactsJson") = 'array'
  );

ALTER TABLE "PlannedAction"
  ADD CONSTRAINT "PlannedAction_planned_month_first_day" CHECK (
    "plannedMonth" IS NULL OR extract(day FROM "plannedMonth") = 1
  ),
  ADD CONSTRAINT "PlannedAction_appointment_range" CHECK (
    ("appointmentStart" IS NULL AND "appointmentEnd" IS NULL)
    OR
    ("appointmentStart" IS NOT NULL
      AND "appointmentEnd" IS NOT NULL
      AND "appointmentEnd" > "appointmentStart")
  );

ALTER TABLE "Reminder"
  ADD CONSTRAINT "Reminder_sent_state" CHECK (
    ("status" = 'sent' AND "sentAt" IS NOT NULL)
    OR ("status" <> 'sent' AND "sentAt" IS NULL)
  );

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_size_nonnegative" CHECK ("sizeBytes" >= 0);

ALTER TABLE "DocumentLink"
  ADD CONSTRAINT "DocumentLink_exactly_one_target" CHECK (
    num_nonnulls("careEventId", "medicationId", "clinicianOverrideId") = 1
  );

ALTER TABLE "SourceSyncLog"
  ADD CONSTRAINT "SourceSyncLog_time_order" CHECK (
    "finishedAt" IS NULL OR "finishedAt" >= "startedAt"
  ),
  ADD CONSTRAINT "SourceSyncLog_http_status_range" CHECK (
    "httpStatus" IS NULL OR "httpStatus" BETWEEN 100 AND 599
  );

ALTER TABLE "ExternalContentCache"
  ADD CONSTRAINT "ExternalContentCache_time_order" CHECK (
    "expiresAt" >= "fetchedAt" AND "lastSuccessfulAt" <= "fetchedAt"
  );

ALTER TABLE "ImportBatch"
  ADD CONSTRAINT "ImportBatch_counts_nonnegative" CHECK (
    "rowCount" >= 0
    AND "validCount" >= 0
    AND "errorCount" >= 0
    AND "validCount" + "errorCount" <= "rowCount"
  ),
  ADD CONSTRAINT "ImportBatch_commit_state" CHECK (
    ("status" = 'committed' AND "committedAt" IS NOT NULL)
    OR ("status" <> 'committed' AND "committedAt" IS NULL)
  );

-- Cross-row consistency: a selected method/rule/import/profile must belong to
-- the same parent as the referencing record.
CREATE UNIQUE INDEX "ServiceMethod_id_serviceId_key" ON "ServiceMethod"("id", "serviceId");
CREATE UNIQUE INDEX "GuidelineRule_id_version_serviceId_key" ON "GuidelineRule"("id", "version", "serviceId");
CREATE UNIQUE INDEX "ImportBatch_id_profileId_key" ON "ImportBatch"("id", "profileId");
CREATE UNIQUE INDEX "Profile_id_householdId_key" ON "Profile"("id", "householdId");

ALTER TABLE "CareEvent"
  ADD CONSTRAINT "CareEvent_method_matches_service_fkey"
    FOREIGN KEY ("methodId", "serviceId")
    REFERENCES "ServiceMethod"("id", "serviceId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CareEvent_import_matches_profile_fkey"
    FOREIGN KEY ("importBatchId", "profileId")
    REFERENCES "ImportBatch"("id", "profileId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicianOverride"
  ADD CONSTRAINT "ClinicianOverride_method_matches_service_fkey"
    FOREIGN KEY ("methodId", "serviceId")
    REFERENCES "ServiceMethod"("id", "serviceId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecommendationInstance"
  ADD CONSTRAINT "RecommendationInstance_rule_matches_service_fkey"
    FOREIGN KEY ("ruleId", "ruleVersion", "serviceId")
    REFERENCES "GuidelineRule"("id", "version", "serviceId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_profile_matches_household_fkey"
    FOREIGN KEY ("profileId", "householdId")
    REFERENCES "Profile"("id", "householdId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Resumable onboarding and explicit backfill assertions are persistent state,
-- not synthetic care events.
CREATE TYPE "HistoryAssertionState" AS ENUM (
  'no_record',
  'never_completed',
  'completed_exact',
  'completed_month',
  'completed_year',
  'completed_date_unknown',
  'unsure',
  'declined',
  'not_applicable_claim'
);

CREATE TABLE "OnboardingDraft" (
  "userId" UUID NOT NULL,
  "step" INTEGER NOT NULL,
  "dataJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OnboardingDraft_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "OnboardingDraft_step_nonnegative" CHECK ("step" >= 0),
  CONSTRAINT "OnboardingDraft_data_object" CHECK (jsonb_typeof("dataJson") = 'object'),
  CONSTRAINT "OnboardingDraft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OnboardingDraft_updatedAt_idx" ON "OnboardingDraft"("updatedAt");

CREATE TABLE "ProfileServiceHistoryState" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "state" "HistoryAssertionState" NOT NULL,
  "recordedAt" TIMESTAMPTZ(3) NOT NULL,
  "recordedByUserId" UUID NOT NULL,
  CONSTRAINT "ProfileServiceHistoryState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfileServiceHistoryState_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProfileServiceHistoryState_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProfileServiceHistoryState_recordedByUserId_fkey"
    FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProfileServiceHistoryState_profileId_serviceId_key"
ON "ProfileServiceHistoryState"("profileId", "serviceId");
CREATE INDEX "ProfileServiceHistoryState_profileId_state_idx"
ON "ProfileServiceHistoryState"("profileId", "state");
CREATE INDEX "ProfileServiceHistoryState_recordedByUserId_recordedAt_idx"
ON "ProfileServiceHistoryState"("recordedByUserId", "recordedAt" DESC);
