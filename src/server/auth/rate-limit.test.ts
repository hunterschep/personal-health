import { beforeEach, describe, expect, it } from "vitest";
import { consumeLoginAttempt, resetRateLimitsForTests } from "./rate-limit";

describe("authentication rate limiter", () => {
  beforeEach(resetRateLimitsForTests);

  it("limits repeated attempts within one window", () => {
    let allowed = true;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      allowed = consumeLoginAttempt("test-key", 1_000).allowed;
    }
    expect(allowed).toBe(false);
  });
});
