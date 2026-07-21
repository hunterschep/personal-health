CREATE TYPE "CustomMaintenanceKind" AS ENUM ('routine', 'lab_bundle');
CREATE TYPE "CustomMaintenanceSource" AS ENUM ('personal', 'clinician', 'app_template');
CREATE TYPE "CustomMaintenanceStatus" AS ENUM ('active', 'ask_clinician', 'disabled');
CREATE TYPE "CustomMaintenanceVisibility" AS ENUM ('profile_access', 'owner_only');
CREATE TYPE "CustomMaintenanceCadenceUnit" AS ENUM ('days', 'weeks', 'months', 'years');

CREATE TABLE "CustomMaintenance" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "templateServiceId" UUID,
    "title" VARCHAR(160) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "purpose" VARCHAR(1000),
    "kind" "CustomMaintenanceKind" NOT NULL DEFAULT 'routine',
    "source" "CustomMaintenanceSource" NOT NULL,
    "clinicianName" VARCHAR(160),
    "practiceName" VARCHAR(160),
    "cadenceValue" INTEGER,
    "cadenceUnit" "CustomMaintenanceCadenceUnit",
    "startDate" DATE,
    "stopDate" DATE,
    "nextDate" DATE,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderDaysBefore" INTEGER,
    "visibility" "CustomMaintenanceVisibility" NOT NULL DEFAULT 'profile_access',
    "notes" VARCHAR(2000),
    "status" "CustomMaintenanceStatus" NOT NULL DEFAULT 'active',
    "disabledAt" TIMESTAMPTZ(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CustomMaintenance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomMaintenance_cadence_pair_check" CHECK (
        ("cadenceValue" IS NULL AND "cadenceUnit" IS NULL) OR
        (
            "cadenceValue" >= 1 AND
            (
                ("cadenceUnit" = 'days' AND "cadenceValue" <= 3650) OR
                ("cadenceUnit" = 'weeks' AND "cadenceValue" <= 520) OR
                ("cadenceUnit" = 'months' AND "cadenceValue" <= 120) OR
                ("cadenceUnit" = 'years' AND "cadenceValue" <= 100)
            )
        )
    ),
    CONSTRAINT "CustomMaintenance_date_range_check" CHECK (
        ("startDate" IS NULL OR "stopDate" IS NULL OR "stopDate" >= "startDate") AND
        ("startDate" IS NULL OR "nextDate" IS NULL OR "nextDate" >= "startDate") AND
        ("stopDate" IS NULL OR "nextDate" IS NULL OR "nextDate" <= "stopDate")
    ),
    CONSTRAINT "CustomMaintenance_reminder_check" CHECK (
        ("reminderEnabled" = false AND "reminderDaysBefore" IS NULL) OR
        ("reminderEnabled" = true AND "nextDate" IS NOT NULL AND "reminderDaysBefore" BETWEEN 0 AND 365)
    )
);

CREATE TABLE "CustomMaintenanceLabEntry" (
    "id" UUID NOT NULL,
    "customMaintenanceId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "note" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomMaintenanceLabEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomMaintenance_profileId_templateServiceId_key"
ON "CustomMaintenance"("profileId", "templateServiceId");

CREATE INDEX "CustomMaintenance_profileId_status_nextDate_idx"
ON "CustomMaintenance"("profileId", "status", "nextDate");

CREATE INDEX "CustomMaintenance_profileId_visibility_idx"
ON "CustomMaintenance"("profileId", "visibility");

CREATE INDEX "CustomMaintenanceLabEntry_customMaintenanceId_sortOrder_idx"
ON "CustomMaintenanceLabEntry"("customMaintenanceId", "sortOrder");

ALTER TABLE "CustomMaintenance"
ADD CONSTRAINT "CustomMaintenance_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomMaintenance"
ADD CONSTRAINT "CustomMaintenance_templateServiceId_fkey"
FOREIGN KEY ("templateServiceId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomMaintenance"
ADD CONSTRAINT "CustomMaintenance_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomMaintenanceLabEntry"
ADD CONSTRAINT "CustomMaintenanceLabEntry_customMaintenanceId_fkey"
FOREIGN KEY ("customMaintenanceId") REFERENCES "CustomMaintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
