import { describe, expect, it } from "vitest";

import { createDatabaseFactory } from "./database";

describe("database factories", () => {
  it("returns identical synthetic records for the same seed", () => {
    const first = createDatabaseFactory(17);
    const second = createDatabaseFactory(17);

    expect(first.user()).toEqual(second.user());
    expect(first.careEvent()).toEqual(second.careEvent());
    expect(first.recommendation()).toEqual(second.recommendation());
  });

  it("uses reserved synthetic identities and permits explicit overrides", () => {
    const factory = createDatabaseFactory(23);

    expect(factory.user().email).toMatch(/@example\.invalid$/);
    expect(factory.profile({ displayName: "Fixture Adult" }).displayName).toBe("Fixture Adult");
  });
});
