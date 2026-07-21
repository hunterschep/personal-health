import { describe, expect, it } from "vitest";
import { sanitizeExternalHtml, sanitizeMyHealthfinderPayload } from "./sanitize";
import { myHealthfinderPayload } from "./test-fixtures.test-helper";

describe("external source sanitization", () => {
  it("removes scripts, event handlers, styles, and unsafe URL schemes", () => {
    const sanitized = sanitizeExternalHtml(
      '<p style="color:red" onclick="steal()">Safe <script>alert(1)</script><a href="javascript:steal()">link</a><a href="https://odphp.health.gov/good">official</a></p>',
    );

    expect(sanitized).toContain("Safe");
    expect(sanitized).toContain("https://odphp.health.gov/good");
    expect(sanitized).not.toMatch(/script|onclick|javascript|style=/i);
  });

  it("sanitizes known HTML fields throughout a valid v4 payload", () => {
    const payload = myHealthfinderPayload();
    payload.Result.Resources.All.Resource[0]!.Sections.section[0]!.Content =
      '<p onmouseover="bad()">Text</p><iframe src="https://bad.example"></iframe>';
    const sanitized = sanitizeMyHealthfinderPayload(payload);
    const encoded = JSON.stringify(sanitized);
    expect(encoded).toContain("<p>Text</p>");
    expect(encoded).not.toMatch(/onmouseover|iframe/i);
  });

  it("rejects malformed or error payloads", () => {
    expect(() => sanitizeMyHealthfinderPayload({ Result: { Error: "False" } })).toThrow();
    const validPayload = myHealthfinderPayload();
    const errorPayload = {
      ...validPayload,
      Result: { ...validPayload.Result, Error: "True" as const },
    };
    expect(() => sanitizeMyHealthfinderPayload(errorPayload)).toThrow(/error payload/i);
  });
});
