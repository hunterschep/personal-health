import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const minimalEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://carecadence:carecadence@localhost:5432/carecadence_test",
  AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters",
};

describe("environment configuration", () => {
  it("accepts a minimal development configuration", () => {
    const environment = parseServerEnv(minimalEnvironment);
    expect(environment.SOURCE_SYNC_ENABLED).toBe(false);
    expect(environment.MAX_UPLOAD_BYTES).toBe(10_485_760);
    expect(environment.SESSION_COOKIE_SECURE).toBeUndefined();
  });

  it("rejects a missing database URL", () => {
    expect(() => parseServerEnv({ ...minimalEnvironment, DATABASE_URL: undefined })).toThrow(
      "DATABASE_URL",
    );
  });

  it("rejects a short authentication secret", () => {
    expect(() => parseServerEnv({ ...minimalEnvironment, AUTH_SECRET: "short" })).toThrow(
      "AUTH_SECRET",
    );
  });

  it("parses an explicit local production cookie override", () => {
    expect(
      parseServerEnv({ ...minimalEnvironment, SESSION_COOKIE_SECURE: "false" })
        .SESSION_COOKIE_SECURE,
    ).toBe(false);
    expect(
      parseServerEnv({ ...minimalEnvironment, SESSION_COOKIE_SECURE: "true" })
        .SESSION_COOKIE_SECURE,
    ).toBe(true);
  });
});
