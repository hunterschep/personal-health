ALTER TABLE "Medication"
ADD COLUMN "notes" VARCHAR(2000),
ADD COLUMN "classCodesJson" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Reminder"
ADD COLUMN "snoozedUntil" TIMESTAMPTZ(3),
ADD COLUMN "snoozedFrom" TIMESTAMPTZ(3);

CREATE INDEX "Reminder_profileId_snoozedUntil_idx"
ON "Reminder"("profileId", "snoozedUntil");

ALTER TABLE "ReminderPreference"
ADD COLUMN "lastDigestSentAt" TIMESTAMPTZ(3);

CREATE TABLE "VisitPrepPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'concise',
    "sectionsJson" JSONB NOT NULL,
    "questionsJson" JSONB NOT NULL,
    "personalNotes" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VisitPrepPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitPrepPreference_userId_profileId_key"
ON "VisitPrepPreference"("userId", "profileId");

CREATE INDEX "VisitPrepPreference_profileId_idx"
ON "VisitPrepPreference"("profileId");

ALTER TABLE "VisitPrepPreference"
ADD CONSTRAINT "VisitPrepPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitPrepPreference"
ADD CONSTRAINT "VisitPrepPreference_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
