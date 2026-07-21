import { describe, expect, it } from "vitest";
import { authCookiesAreSecure } from "./auth";

describe("authentication cookie security", () => {
  it("defaults to secure cookies in production", () => {
    expect(authCookiesAreSecure({ NODE_ENV: "production" })).toBe(true);
    expect(authCookiesAreSecure({ NODE_ENV: "development" })).toBe(false);
  });

  it("honors the explicit HTTP smoke-test override", () => {
    expect(authCookiesAreSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: false })).toBe(
      false,
    );
    expect(authCookiesAreSecure({ NODE_ENV: "test", SESSION_COOKIE_SECURE: true })).toBe(true);
  });
});
