export const FIXED_CONDITIONS = [
  { key: "hypertension", code: "hypertension", label: "Hypertension" },
  { key: "diabetes", code: "diabetes", label: "Diabetes" },
  {
    key: "cardiovascularDisease",
    code: "cardiovascular-disease",
    label: "Cardiovascular disease",
  },
  { key: "priorCancer", code: "prior-cancer", label: "Prior cancer" },
  {
    key: "priorAbnormalScreening",
    code: "prior-abnormal-screening",
    label: "Prior abnormal screening",
  },
  {
    key: "osteoporosisFragility",
    code: "osteoporosis-or-fragility-fracture",
    label: "Osteoporosis or fragility fracture",
  },
] as const;

export type FixedConditionKey = (typeof FIXED_CONDITIONS)[number]["key"];

export const MIN_HEIGHT_INCHES = 60 / 2.54;
export const MAX_HEIGHT_INCHES = 280 / 2.54;
export const MIN_WEIGHT_POUNDS = 20 / 0.45359237;
export const MAX_WEIGHT_POUNDS = 600 / 0.45359237;
