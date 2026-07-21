ALTER TABLE "ClinicianOverride"
ADD COLUMN "pausedAt" TIMESTAMPTZ(3);

DROP INDEX "ClinicianOverride_profileId_serviceId_active_idx";
DROP INDEX "ClinicianOverride_reviewDate_active_idx";

CREATE INDEX "ClinicianOverride_profileId_serviceId_active_pausedAt_idx"
ON "ClinicianOverride"("profileId", "serviceId", "active", "pausedAt");

CREATE INDEX "ClinicianOverride_reviewDate_active_pausedAt_idx"
ON "ClinicianOverride"("reviewDate", "active", "pausedAt");
