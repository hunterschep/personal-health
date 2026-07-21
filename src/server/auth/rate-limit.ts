import { createHash } from "node:crypto";
import { getServerEnv } from "@/config/env";

type Bucket = { attempts: number; resetsAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function keyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function loginRateLimitKey(email: string, request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipPrefix = forwarded?.split(".").slice(0, 3).join(".") ?? "local";
  return keyHash(`${email.trim().toLowerCase()}|${ipPrefix}`);
}

export function networkRateLimitKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const network = forwarded?.split(".").slice(0, 3).join(".") ?? "local";
  return keyHash(`${scope}|${network}`);
}

export function accountRateLimitKey(userId: string, scope: string): string {
  return keyHash(`${scope}|${userId}`);
}

export function consumeLoginAttempt(
  key: string,
  now = Date.now(),
  limitMultiplier = 1,
): { allowed: boolean; retryAfterSeconds: number } {
  const environment = getServerEnv();
  const windowMs = environment.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60_000;
  if (buckets.size >= MAX_BUCKETS) {
    for (const [candidate, bucket] of buckets) {
      if (bucket.resetsAt <= now || buckets.size >= MAX_BUCKETS) buckets.delete(candidate);
      if (buckets.size < MAX_BUCKETS) break;
    }
  }
  const existing = buckets.get(key);
  const bucket =
    existing === undefined || existing.resetsAt <= now
      ? { attempts: 0, resetsAt: now + windowMs }
      : existing;
  bucket.attempts += 1;
  buckets.set(key, bucket);
  return {
    allowed: bucket.attempts <= environment.AUTH_RATE_LIMIT_ATTEMPTS * limitMultiplier,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)),
  };
}

export function clearLoginAttempts(key: string): void {
  buckets.delete(key);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
