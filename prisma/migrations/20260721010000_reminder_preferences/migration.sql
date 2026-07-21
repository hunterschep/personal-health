CREATE TYPE "ReminderDigestMode" AS ENUM ('individual', 'daily', 'weekly');

CREATE TABLE "ReminderPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "unknownHistoryPrompts" BOOLEAN NOT NULL DEFAULT true,
    "quietDaysJson" JSONB NOT NULL DEFAULT '[]',
    "quietHoursStart" VARCHAR(5),
    "quietHoursEnd" VARCHAR(5),
    "dueSoonWindowDays" INTEGER NOT NULL DEFAULT 90,
    "householdActivityDetail" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(80) NOT NULL,
    "digestMode" "ReminderDigestMode" NOT NULL DEFAULT 'individual',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderPreference_userId_profileId_key"
ON "ReminderPreference"("userId", "profileId");

CREATE INDEX "ReminderPreference_profileId_emailEnabled_idx"
ON "ReminderPreference"("profileId", "emailEnabled");

ALTER TABLE "ReminderPreference"
ADD CONSTRAINT "ReminderPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderPreference"
ADD CONSTRAINT "ReminderPreference_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
