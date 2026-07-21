import { describe, expect, it } from "vitest";

import { createRequestId, REQUEST_ID_HEADER } from "./request-id";

describe("request correlation identifiers", () => {
  it("creates opaque UUIDs without caller-provided context", () => {
    const first = createRequestId();
    const second = createRequestId();

    expect(REQUEST_ID_HEADER).toBe("x-request-id");
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
