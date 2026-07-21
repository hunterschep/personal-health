import { describe, expect, it } from "vitest";
import { appUrl } from "./app-url";

describe("application URLs", () => {
  it("uses the canonical public origin when the standalone server has an internal host", () => {
    expect(
      appUrl("/app", "http://0.0.0.0:3000/api/auth/sign-in", "https://health.example.test"),
    ).toEqual(new URL("https://health.example.test/app"));
  });

  it("falls back to the request origin and rejects cross-origin paths", () => {
    expect(appUrl("/sign-in", "http://localhost:3000/app", "")).toEqual(
      new URL("http://localhost:3000/sign-in"),
    );
    expect(() => appUrl("//attacker.example", "http://localhost:3000/app", "")).toThrow(RangeError);
  });
});
