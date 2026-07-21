import { describe, expect, it } from "vitest";

import { createContentSecurityPolicy, createSecurityHeaders } from "./headers";

describe("security response headers", () => {
  it("builds a nonce-protected production content security policy", () => {
    const policy = createContentSecurityPolicy({ nonce: "test-nonce", isDevelopment: false });

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("limits unsafe eval to local Next.js development", () => {
    expect(createContentSecurityPolicy({ nonce: "dev-nonce", isDevelopment: true })).toContain(
      "'unsafe-eval'",
    );
  });

  it("adds HSTS only to production responses", () => {
    const production = createSecurityHeaders(true);
    const development = createSecurityHeaders(false);

    expect(production).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
    expect(development.map((header) => header.key)).not.toContain("Strict-Transport-Security");
  });
});
