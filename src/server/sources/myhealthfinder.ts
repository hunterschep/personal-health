import { z } from "zod";
import { ExternalSourceError } from "@/domain/shared/errors";
import { hashJson, toJsonValue, type JsonValue } from "./hash";
import { sanitizeMyHealthfinderPayload, type MyHealthfinderPayload } from "./sanitize";

export const MYHEALTHFINDER_API_VERSION = "4" as const;
export const MYHEALTHFINDER_ENDPOINT =
  "https://odphp.health.gov/myhealthfinder/api/v4/myhealthfinder.json" as const;

const yesNoSchema = z.enum(["yes", "no"]);

export const anonymousMyHealthfinderInputSchema = z
  .object({
    age: z.number().int().min(18).max(120),
    sex: z.enum(["female", "male"]),
    pregnant: yesNoSchema.optional(),
    sexuallyActive: yesNoSchema.optional(),
    tobaccoUse: yesNoSchema.optional(),
    language: z.enum(["en", "es"]).default("en"),
  })
  .strict();
export type AnonymousMyHealthfinderInput = z.input<typeof anonymousMyHealthfinderInputSchema>;
export type NormalizedAnonymousMyHealthfinderInput = z.output<
  typeof anonymousMyHealthfinderInputSchema
>;

export const myHealthfinderProfileInputSchema = z
  .object({
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sexAssignedAtBirth: z.enum(["female", "male", "intersex", "unknown", "prefer_not_to_answer"]),
    pregnant: yesNoSchema.optional(),
    sexuallyActive: yesNoSchema.optional(),
    tobaccoUse: yesNoSchema.optional(),
    language: z.enum(["en", "es"]).optional(),
  })
  .strict();
export type MyHealthfinderProfileInput = z.infer<typeof myHealthfinderProfileInputSchema>;

export type AnonymousInputConversion =
  | { eligible: true; input: NormalizedAnonymousMyHealthfinderInput }
  | {
      eligible: false;
      reason: "unsupported_sex_value" | "outside_adult_age_range" | "invalid_birth_date";
    };

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function ageOnDate(dateOfBirth: string, asOfDate: string): number | null {
  const birth = parseIsoDate(dateOfBirth);
  const asOf = parseIsoDate(asOfDate);
  if (birth === null || asOf === null) return null;

  let age = asOf.year - birth.year;
  if (asOf.month < birth.month || (asOf.month === birth.month && asOf.day < birth.day)) {
    age -= 1;
  }
  return age;
}

export function toAnonymousMyHealthfinderInput(
  rawProfile: MyHealthfinderProfileInput,
  asOfDate: string,
): AnonymousInputConversion {
  const profileResult = myHealthfinderProfileInputSchema.safeParse(rawProfile);
  if (!profileResult.success) return { eligible: false, reason: "invalid_birth_date" };

  const profile = profileResult.data;
  if (profile.sexAssignedAtBirth !== "female" && profile.sexAssignedAtBirth !== "male") {
    return { eligible: false, reason: "unsupported_sex_value" };
  }

  const age = ageOnDate(profile.dateOfBirth, asOfDate);
  if (age === null) return { eligible: false, reason: "invalid_birth_date" };
  if (age < 18 || age > 120) return { eligible: false, reason: "outside_adult_age_range" };

  const anonymousCandidate: AnonymousMyHealthfinderInput = {
    age,
    sex: profile.sexAssignedAtBirth,
    ...(profile.pregnant === undefined ? {} : { pregnant: profile.pregnant }),
    ...(profile.sexuallyActive === undefined ? {} : { sexuallyActive: profile.sexuallyActive }),
    ...(profile.tobaccoUse === undefined ? {} : { tobaccoUse: profile.tobaccoUse }),
    ...(profile.language === undefined ? {} : { language: profile.language }),
  };

  return { eligible: true, input: anonymousMyHealthfinderInputSchema.parse(anonymousCandidate) };
}

function anonymousTuple(input: NormalizedAnonymousMyHealthfinderInput): JsonValue {
  return {
    apiVersion: MYHEALTHFINDER_API_VERSION,
    age: input.age,
    language: input.language,
    pregnant: input.pregnant ?? null,
    sex: input.sex,
    sexuallyActive: input.sexuallyActive ?? null,
    tobaccoUse: input.tobaccoUse ?? null,
  };
}

export function createMyHealthfinderCacheKey(rawInput: AnonymousMyHealthfinderInput): string {
  const input = anonymousMyHealthfinderInputSchema.parse(rawInput);
  return `myhealthfinder:v${MYHEALTHFINDER_API_VERSION}:${hashJson(anonymousTuple(input))}`;
}

export function buildMyHealthfinderUrl(rawInput: AnonymousMyHealthfinderInput): URL {
  const input = anonymousMyHealthfinderInputSchema.parse(rawInput);
  const url = new URL(MYHEALTHFINDER_ENDPOINT);
  url.searchParams.set("age", String(input.age));
  url.searchParams.set("sex", input.sex);
  if (input.pregnant !== undefined) url.searchParams.set("pregnant", input.pregnant);
  if (input.sexuallyActive !== undefined) {
    url.searchParams.set("sexuallyActive", input.sexuallyActive);
  }
  if (input.tobaccoUse !== undefined) url.searchParams.set("tobaccoUse", input.tobaccoUse);
  if (input.language !== "en") url.searchParams.set("Lang", input.language);
  return url;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Sleep = (milliseconds: number) => Promise<void>;

export type MyHealthfinderClientOptions = {
  fetch?: FetchLike;
  sleep?: Sleep;
  now?: () => Date;
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  maxResponseBytes?: number;
};

export type MyHealthfinderFetchResult = {
  payload: MyHealthfinderPayload;
  contentHash: string;
  fetchedAt: string;
  httpStatus: number;
};

class TransientResponseError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(status: number, retryAfter: string | null) {
    super(`Transient MyHealthfinder response: ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryDelay(
  attempt: number,
  retryAfter: string | null,
  baseDelayMs: number,
  maximumDelayMs: number,
): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, maximumDelayMs);
    }

    const retryDate = Date.parse(retryAfter);
    if (Number.isFinite(retryDate)) {
      return Math.min(Math.max(0, retryDate - Date.now()), maximumDelayMs);
    }
  }
  return Math.min(baseDelayMs * 2 ** attempt, maximumDelayMs);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof TransientResponseError || error instanceof TypeError || isAbortError(error)
  );
}

export class MyHealthfinderClient {
  private readonly request: FetchLike;
  private readonly sleep: Sleep;
  private readonly now: () => Date;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: MyHealthfinderClientOptions = {}) {
    this.request = options.fetch ?? globalThis.fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 250;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 2_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 5_000_000;

    if (this.timeoutMs <= 0 || this.maxRetries < 0 || this.maxResponseBytes <= 0) {
      throw new RangeError("MyHealthfinder client limits must be positive.");
    }
  }

  async fetch(rawInput: AnonymousMyHealthfinderInput): Promise<MyHealthfinderFetchResult> {
    const input = anonymousMyHealthfinderInputSchema.parse(rawInput);
    const url = buildMyHealthfinderUrl(input);
    let finalError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.request(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (TRANSIENT_STATUS_CODES.has(response.status)) {
            throw new TransientResponseError(response.status, response.headers.get("retry-after"));
          }
          throw new ExternalSourceError(
            `MyHealthfinder request failed with status ${response.status}.`,
          );
        }

        const rawText = await response.text();
        if (Buffer.byteLength(rawText, "utf8") > this.maxResponseBytes) {
          throw new ExternalSourceError("MyHealthfinder response exceeded the safe size limit.");
        }

        let decoded: unknown;
        try {
          decoded = JSON.parse(rawText) as unknown;
        } catch (error) {
          throw new ExternalSourceError("MyHealthfinder returned malformed JSON.", {
            cause: error,
          });
        }

        const payload = sanitizeMyHealthfinderPayload(decoded);
        return {
          payload,
          contentHash: hashJson(toJsonValue(payload)),
          fetchedAt: this.now().toISOString(),
          httpStatus: response.status,
        };
      } catch (error) {
        finalError = error;
        if (!isRetryable(error) || attempt === this.maxRetries) break;

        const transient = error instanceof TransientResponseError ? error : null;
        await this.sleep(
          retryDelay(
            attempt,
            transient?.retryAfter ?? null,
            this.baseRetryDelayMs,
            this.maxRetryDelayMs,
          ),
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw finalError instanceof ExternalSourceError
      ? finalError
      : new ExternalSourceError("MyHealthfinder content is temporarily unavailable.", {
          cause: finalError,
        });
  }
}
