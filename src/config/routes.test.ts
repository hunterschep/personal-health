import { describe, expect, it } from "vitest";
import { staticRouteValues } from "./routes";

describe("route constants", () => {
  it("are unique", () => {
    expect(new Set(staticRouteValues).size).toBe(staticRouteValues.length);
  });
});
