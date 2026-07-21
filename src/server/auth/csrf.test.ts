import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "./csrf";

describe("same-origin mutation protection", () => {
  it("accepts a matching origin and host", () => {
    const request = new Request("https://care.example/api/write", {
      headers: { origin: "https://care.example", host: "care.example" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a cross-origin request", () => {
    const request = new Request("https://care.example/api/write", {
      headers: { origin: "https://attacker.example", host: "care.example" },
    });
    expect(() => assertSameOrigin(request)).toThrow("not available");
  });
});
