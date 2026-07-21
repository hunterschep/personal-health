import type { RecommendationClass as ContractRecommendationClass } from "@/contracts/recommendations";
import type { RecommendationClass as DatabaseRecommendationClass } from "@/generated/prisma/client";

export function toDatabaseRecommendationClass(
  value: ContractRecommendationClass,
): DatabaseRecommendationClass {
  switch (value) {
    case "routine":
    case "selective":
      return value;
    case "shared-decision":
      return "shared_decision";
    case "insufficient-evidence":
      return "insufficient_evidence";
    case "not-recommended":
      return "not_recommended";
    case "custom-maintenance":
      return "custom_maintenance";
  }
}

export function fromDatabaseRecommendationClass(
  value: DatabaseRecommendationClass,
): ContractRecommendationClass {
  switch (value) {
    case "routine":
    case "selective":
      return value;
    case "shared_decision":
      return "shared-decision";
    case "insufficient_evidence":
      return "insufficient-evidence";
    case "not_recommended":
      return "not-recommended";
    case "custom_maintenance":
      return "custom-maintenance";
  }
}
