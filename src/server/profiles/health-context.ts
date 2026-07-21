import { z } from "zod";

import {
  anatomyKeySchema,
  anatomyStateSchema,
  riskFactorPayloadSchemas,
  type AnatomyKey,
  type AnatomyState,
} from "@/contracts/profile";
import {
  FIXED_CONDITIONS,
  MAX_HEIGHT_INCHES,
  MAX_WEIGHT_POUNDS,
  MIN_HEIGHT_INCHES,
  MIN_WEIGHT_POUNDS,
} from "@/domain/profile-context/constants";
import { ValidationError } from "@/domain/shared/errors";
import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/db/transactions";

export {
  FIXED_CONDITIONS,
  MAX_HEIGHT_INCHES,
  MAX_WEIGHT_POUNDS,
  MIN_HEIGHT_INCHES,
  MIN_WEIGHT_POUNDS,
};

const optionalNumberInput = (minimum: number, maximum: number, integer = false) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    (integer ? z.coerce.number().int() : z.coerce.number()).min(minimum).max(maximum).nullable(),
  );

const optionalNote = (maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().min(1).max(maximum).nullable(),
  );

const optionalAnatomyKey = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  anatomyKeySchema.nullable(),
);
const optionalAnatomyState = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  anatomyStateSchema.nullable(),
);

const conditionSelectionSchema = z.object({
  hypertension: z.boolean().default(false),
  diabetes: z.boolean().default(false),
  cardiovascularDisease: z.boolean().default(false),
  priorCancer: z.boolean().default(false),
  priorAbnormalScreening: z.boolean().default(false),
  osteoporosisFragility: z.boolean().default(false),
});

export const profileHealthContextInputSchema = z
  .object({
    tobaccoStatus: z
      .enum(["never", "current", "former", "unknown", "prefer_not_to_answer"])
      .default("unknown"),
    smokingStartYear: optionalNumberInput(1900, 2200, true),
    smokingEndYear: optionalNumberInput(1900, 2200, true),
    packsPerDay: optionalNumberInput(0, 20),
    heightInches: optionalNumberInput(MIN_HEIGHT_INCHES, MAX_HEIGHT_INCHES),
    weightPounds: optionalNumberInput(MIN_WEIGHT_POUNDS, MAX_WEIGHT_POUNDS),
    pregnancyStatus: z
      .enum(["pregnant", "not_pregnant", "unknown", "prefer_not_to_answer"])
      .default("unknown"),
    immunocompromised: z.enum(["yes", "no", "unknown"]).default("unknown"),
    alcoholAssessmentPreference: z.enum(["yes", "no", "unknown"]).default("unknown"),
    fallConcern: z.enum(["yes", "no", "unknown"]).default("unknown"),
    sexualHealthRisk: z.enum(["present", "absent", "unknown"]).default("unknown"),
    conditions: conditionSelectionSchema.default({
      hypertension: false,
      diabetes: false,
      cardiovascularDisease: false,
      priorCancer: false,
      priorAbnormalScreening: false,
      osteoporosisFragility: false,
    }),
    familyHistoryNote: optionalNote(1000),
    surgeryNote: optionalNote(1000),
    surgeryAnatomyKey: optionalAnatomyKey,
    surgeryAnatomyState: optionalAnatomyState,
    confirmSurgeryAnatomy: z.boolean().default(false),
  })
  .superRefine((input, context) => {
    const hasSmokingDetails =
      input.smokingStartYear !== null ||
      input.smokingEndYear !== null ||
      input.packsPerDay !== null;
    if (
      hasSmokingDetails &&
      input.tobaccoStatus !== "current" &&
      input.tobaccoStatus !== "former"
    ) {
      context.addIssue({
        code: "custom",
        path: ["tobaccoStatus"],
        message: "Smoking years and amount require current or former tobacco status.",
      });
    }
    if (input.tobaccoStatus === "current" && input.smokingEndYear !== null) {
      context.addIssue({
        code: "custom",
        path: ["smokingEndYear"],
        message: "A current tobacco history cannot have a quit year.",
      });
    }
    if (
      input.smokingStartYear !== null &&
      input.smokingEndYear !== null &&
      input.smokingEndYear < input.smokingStartYear
    ) {
      context.addIssue({
        code: "custom",
        path: ["smokingEndYear"],
        message: "Quit year must be the same as or later than the start year.",
      });
    }
    const hasAnatomyProposal =
      input.surgeryAnatomyKey !== null || input.surgeryAnatomyState !== null;
    if (hasAnatomyProposal && input.surgeryNote === null) {
      context.addIssue({
        code: "custom",
        path: ["surgeryNote"],
        message: "Add the relevant surgery before proposing an anatomy update.",
      });
    }
    if (hasAnatomyProposal && input.surgeryAnatomyKey === null) {
      context.addIssue({
        code: "custom",
        path: ["surgeryAnatomyKey"],
        message: "Choose the anatomy affected by the surgery.",
      });
    }
    if (hasAnatomyProposal && input.surgeryAnatomyState === null) {
      context.addIssue({
        code: "custom",
        path: ["surgeryAnatomyState"],
        message: "Choose the proposed anatomy state.",
      });
    }
    if (hasAnatomyProposal && !input.confirmSurgeryAnatomy) {
      context.addIssue({
        code: "custom",
        path: ["confirmSurgeryAnatomy"],
        message: "Confirm the proposed anatomy update before saving.",
      });
    }
    if (!hasAnatomyProposal && input.confirmSurgeryAnatomy) {
      context.addIssue({
        code: "custom",
        path: ["confirmSurgeryAnatomy"],
        message: "Choose an anatomy update before confirming it.",
      });
    }
  });

export type ProfileHealthContextForm = z.infer<typeof profileHealthContextInputSchema>;

export type NormalizedProfileHealthContext = {
  form: ProfileHealthContextForm;
  tobaccoRisk: z.infer<typeof riskFactorPayloadSchemas.tobacco_use>;
  heightWeightRisk: z.infer<typeof riskFactorPayloadSchemas.height_weight> | null;
  pregnancyRisk: z.infer<typeof riskFactorPayloadSchemas.pregnancy_status>;
  immunocompromisedRisk: z.infer<typeof riskFactorPayloadSchemas.immunocompromised>;
  alcoholRisk: z.infer<typeof riskFactorPayloadSchemas.alcohol_use>;
  fallRisk: z.infer<typeof riskFactorPayloadSchemas.fall_risk>;
  sexualHealthRisk: z.infer<typeof riskFactorPayloadSchemas.sexual_health_risk>;
  anatomyUpdate: { key: AnatomyKey; state: AnatomyState } | null;
  selectedConditionCodes: Set<string>;
};

export function normalizeProfileHealthContext(
  input: unknown,
  { dateOfBirth, measuredOn }: { dateOfBirth: string; measuredOn: string },
): NormalizedProfileHealthContext {
  const form = profileHealthContextInputSchema.parse(input);
  const birthYear = Number(dateOfBirth.slice(0, 4));
  const currentYear = Number(measuredOn.slice(0, 4));
  for (const [field, year] of [
    ["smokingStartYear", form.smokingStartYear],
    ["smokingEndYear", form.smokingEndYear],
  ] as const) {
    if (year !== null && year < birthYear) {
      throw new ValidationError(
        `${field === "smokingStartYear" ? "Start" : "Quit"} year cannot be before the birth year.`,
      );
    }
    if (year !== null && year > currentYear) {
      throw new ValidationError(
        `${field === "smokingStartYear" ? "Start" : "Quit"} year cannot be in the future.`,
      );
    }
  }

  const hasSmokingPeriod = form.tobaccoStatus === "current" || form.tobaccoStatus === "former";
  const tobaccoRisk = riskFactorPayloadSchemas.tobacco_use.parse({
    status: form.tobaccoStatus,
    periods: hasSmokingPeriod
      ? [
          {
            started: null,
            ended: null,
            startedYear: form.smokingStartYear,
            endedYear: form.smokingEndYear,
            packsPerDay: form.packsPerDay,
          },
        ]
      : [],
  });
  const heightWeightRisk =
    form.heightInches === null && form.weightPounds === null
      ? null
      : riskFactorPayloadSchemas.height_weight.parse({
          measuredOn,
          heightCentimeters:
            form.heightInches === null ? null : Math.round(form.heightInches * 2.54 * 100) / 100,
          weightKilograms:
            form.weightPounds === null
              ? null
              : Math.round(form.weightPounds * 0.45359237 * 100) / 100,
        });
  const immunocompromisedRisk = riskFactorPayloadSchemas.immunocompromised.parse({
    value: form.immunocompromised,
  });
  const pregnancyRisk = riskFactorPayloadSchemas.pregnancy_status.parse({
    value: form.pregnancyStatus,
  });
  const alcoholRisk = riskFactorPayloadSchemas.alcohol_use.parse({
    assessmentPreferred:
      form.alcoholAssessmentPreference === "unknown"
        ? null
        : form.alcoholAssessmentPreference === "yes",
    riskLevel: null,
  });
  const fallRisk = riskFactorPayloadSchemas.fall_risk.parse({ concern: form.fallConcern });
  const sexualHealthRisk = riskFactorPayloadSchemas.sexual_health_risk.parse({
    value: form.sexualHealthRisk,
  });
  const selectedConditionCodes = new Set(
    FIXED_CONDITIONS.filter(({ key }) => form.conditions[key]).map(({ code }) => code),
  );
  return {
    form,
    tobaccoRisk,
    heightWeightRisk,
    pregnancyRisk,
    immunocompromisedRisk,
    alcoholRisk,
    fallRisk,
    sexualHealthRisk,
    anatomyUpdate:
      form.surgeryAnatomyKey === null || form.surgeryAnatomyState === null
        ? null
        : { key: form.surgeryAnatomyKey, state: form.surgeryAnatomyState },
    selectedConditionCodes,
  };
}

function jsonPayload(value: object): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

async function synchronizeRiskFactor(
  database: DatabaseClient,
  profileId: string,
  type:
    | "tobacco_use"
    | "height_weight"
    | "pregnancy_status"
    | "immunocompromised"
    | "alcohol_use"
    | "fall_risk"
    | "sexual_health_risk",
  payload: object | null,
  now: Date,
): Promise<number> {
  const records = await database.riskFactor.findMany({
    where: { profileId, type },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, deletedAt: true },
  });
  if (payload === null) {
    await database.riskFactor.updateMany({
      where: { profileId, type, deletedAt: null },
      data: { deletedAt: now },
    });
    return 0;
  }

  const canonical = records[0];
  const canonicalId =
    canonical === undefined
      ? (
          await database.riskFactor.create({
            data: {
              profileId,
              type,
              valueJson: jsonPayload(payload),
              source: "user",
            },
            select: { id: true },
          })
        ).id
      : (
          await database.riskFactor.update({
            where: { id: canonical.id },
            data: {
              valueJson: jsonPayload(payload),
              source: "user",
              startedAt: null,
              endedAt: null,
              deletedAt: null,
            },
            select: { id: true },
          })
        ).id;
  await database.riskFactor.updateMany({
    where: { profileId, type, id: { not: canonicalId }, deletedAt: null },
    data: { deletedAt: now },
  });
  return 1;
}

async function synchronizeConditions(
  database: DatabaseClient,
  profileId: string,
  selectedCodes: Set<string>,
  now: Date,
): Promise<void> {
  const allowedCodes = FIXED_CONDITIONS.map(({ code }) => code);
  const records = await database.condition.findMany({
    where: { profileId, code: { in: allowedCodes } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, code: true, deletedAt: true },
  });
  for (const condition of FIXED_CONDITIONS) {
    const matches = records.filter(({ code }) => code === condition.code);
    if (!selectedCodes.has(condition.code)) {
      await database.condition.updateMany({
        where: { profileId, code: condition.code, deletedAt: null },
        data: { deletedAt: now },
      });
      continue;
    }
    const canonical = matches[0];
    const canonicalId =
      canonical === undefined
        ? (
            await database.condition.create({
              data: {
                profileId,
                code: condition.code,
                displayName: condition.label,
                status: "active",
                diagnosedDatePrecision: "unknown",
              },
              select: { id: true },
            })
          ).id
        : (
            await database.condition.update({
              where: { id: canonical.id },
              data: {
                displayName: condition.label,
                status: "active",
                deletedAt: null,
              },
              select: { id: true },
            })
          ).id;
    await database.condition.updateMany({
      where: { profileId, code: condition.code, id: { not: canonicalId }, deletedAt: null },
      data: { deletedAt: now },
    });
  }
}

async function synchronizeFamilyHistoryNote(
  database: DatabaseClient,
  profileId: string,
  note: string | null,
  now: Date,
): Promise<number> {
  const records = await database.familyHistory.findMany({
    where: { profileId, conditionCode: "user-reported-family-history" },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (note === null) {
    await database.familyHistory.updateMany({
      where: {
        profileId,
        conditionCode: "user-reported-family-history",
        deletedAt: null,
      },
      data: { deletedAt: now },
    });
    return 0;
  }
  const canonical = records[0];
  const canonicalId =
    canonical === undefined
      ? (
          await database.familyHistory.create({
            data: {
              profileId,
              relationship: "reported",
              conditionCode: "user-reported-family-history",
              conditionDisplay: "User-reported family history",
              note,
            },
            select: { id: true },
          })
        ).id
      : (
          await database.familyHistory.update({
            where: { id: canonical.id },
            data: { note, deletedAt: null },
            select: { id: true },
          })
        ).id;
  await database.familyHistory.updateMany({
    where: {
      profileId,
      conditionCode: "user-reported-family-history",
      id: { not: canonicalId },
      deletedAt: null,
    },
    data: { deletedAt: now },
  });
  return 1;
}

async function synchronizeSurgeryNote(
  database: DatabaseClient,
  profileId: string,
  note: string | null,
  now: Date,
): Promise<number> {
  const records = await database.surgery.findMany({
    where: { profileId, code: "user-reported-surgery" },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (note === null) {
    await database.surgery.updateMany({
      where: { profileId, code: "user-reported-surgery", deletedAt: null },
      data: { deletedAt: now },
    });
    return 0;
  }
  const canonical = records[0];
  const canonicalId =
    canonical === undefined
      ? (
          await database.surgery.create({
            data: {
              profileId,
              code: "user-reported-surgery",
              displayName: "User-reported surgery",
              performedDatePrecision: "unknown",
              note,
            },
            select: { id: true },
          })
        ).id
      : (
          await database.surgery.update({
            where: { id: canonical.id },
            data: { note, deletedAt: null },
            select: { id: true },
          })
        ).id;
  await database.surgery.updateMany({
    where: {
      profileId,
      code: "user-reported-surgery",
      id: { not: canonicalId },
      deletedAt: null,
    },
    data: { deletedAt: now },
  });
  return 1;
}

export async function synchronizeProfileHealthContext(
  database: DatabaseClient,
  profileId: string,
  context: NormalizedProfileHealthContext,
  now = new Date(),
) {
  const riskFactorCount =
    (await synchronizeRiskFactor(database, profileId, "tobacco_use", context.tobaccoRisk, now)) +
    (await synchronizeRiskFactor(
      database,
      profileId,
      "height_weight",
      context.heightWeightRisk,
      now,
    )) +
    (await synchronizeRiskFactor(
      database,
      profileId,
      "pregnancy_status",
      context.pregnancyRisk,
      now,
    )) +
    (await synchronizeRiskFactor(
      database,
      profileId,
      "immunocompromised",
      context.immunocompromisedRisk,
      now,
    )) +
    (await synchronizeRiskFactor(database, profileId, "alcohol_use", context.alcoholRisk, now)) +
    (await synchronizeRiskFactor(database, profileId, "fall_risk", context.fallRisk, now)) +
    (await synchronizeRiskFactor(
      database,
      profileId,
      "sexual_health_risk",
      context.sexualHealthRisk,
      now,
    ));
  await synchronizeConditions(database, profileId, context.selectedConditionCodes, now);
  const narrativeContextCount =
    (await synchronizeFamilyHistoryNote(database, profileId, context.form.familyHistoryNote, now)) +
    (await synchronizeSurgeryNote(database, profileId, context.form.surgeryNote, now));
  return {
    riskFactorCount,
    conditionCount: context.selectedConditionCodes.size,
    narrativeContextCount,
  };
}
