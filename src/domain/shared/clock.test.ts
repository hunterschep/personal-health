import { describe, expect, it } from "vitest";
import { TestClock } from "./clock";

describe("TestClock", () => {
  it("returns deterministic local dates", () => {
    const clock = new TestClock("2026-01-01T02:30:00.000Z");
    expect(clock.today("UTC")).toBe("2026-01-01");
    expect(clock.today("America/Los_Angeles")).toBe("2025-12-31");
    expect(clock.now().toISOString()).toBe("2026-01-01T02:30:00.000Z");
  });
});
