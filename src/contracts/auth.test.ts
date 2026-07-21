import { describe, expect, it } from "vitest";

import { registrationSchema } from "./auth";

const validRegistration = {
  name: "Test Adult",
  email: "adult@example.test",
  password: "a-long-passphrase",
  passwordConfirmation: "a-long-passphrase",
};

describe("registrationSchema", () => {
  it("accepts the string posted by the required HTML checkbox", () => {
    expect(
      registrationSchema.parse({ ...validRegistration, acknowledged: "true" }).acknowledged,
    ).toBe(true);
  });

  it("rejects a missing medical and privacy acknowledgement", () => {
    expect(registrationSchema.safeParse(validRegistration).success).toBe(false);
  });
});
