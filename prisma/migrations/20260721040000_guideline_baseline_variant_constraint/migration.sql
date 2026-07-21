-- A baseline guideline variant can be represented by several active rule rows
-- (for example, separate age segments). The initial unique index incorrectly
-- limited each conflict group to one row rather than one distinct variant.
DROP INDEX "GuidelineRule_active_conflict_baseline_key";

-- btree_gist supplies the text inequality operator needed by the exclusion
-- constraint. Rows with the same group and variant do not conflict; rows with
-- the same group and different variants do.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "GuidelineRule"
ADD CONSTRAINT "GuidelineRule_active_conflict_baseline_variant_excl"
EXCLUDE USING gist (
  "conflictGroup" WITH =,
  "variantId" WITH <>
)
WHERE (
  "isBaseline" = true
  AND "reviewStatus" = 'active'
  AND "effectiveTo" IS NULL
  AND "conflictGroup" IS NOT NULL
);

-- Recommendation calculations are stored as a structured object. Databases
-- created from the initial migration constrained that value to an array, so
-- preserve any legacy token arrays by wrapping them in the current shape.
ALTER TABLE "RecommendationInstance"
DROP CONSTRAINT "RecommendationInstance_explanation_array";

UPDATE "RecommendationInstance"
SET "explanationJson" = jsonb_build_object(
  'tokens', "explanationJson",
  'limitations', '[]'::jsonb,
  'generalGuidelineDueRange', NULL,
  'personalDueRange', NULL,
  'calculationTrace', '[]'::jsonb
)
WHERE jsonb_typeof("explanationJson") = 'array';

ALTER TABLE "RecommendationInstance"
ADD CONSTRAINT "RecommendationInstance_explanation_shapes" CHECK (
  jsonb_typeof("explanationJson") = 'object'
  AND jsonb_typeof("matchingFactsJson") = 'array'
);

-- The deterministic engine hash is shorter than 64 characters. CHAR padded
-- values on reads, which made an unchanged rebuild look different.
ALTER TABLE "RecommendationInstance"
ALTER COLUMN "calculationHash" TYPE VARCHAR(64)
USING rtrim("calculationHash");
