// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

describe("security proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses a different nonce for every application request", () => {
    const request = new NextRequest("https://carecadence.example/app", {
      headers: { cookie: "carecadence.session=opaque-test-token" },
    });
    const firstPolicy = proxy(request).headers.get("Content-Security-Policy");
    const secondPolicy = proxy(request).headers.get("Content-Security-Policy");

    expect(firstPolicy).toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
    expect(secondPolicy).toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
    expect(firstPolicy).not.toBe(secondPolicy);
  });

  it("uses a new opaque correlation identifier for every response", () => {
    const request = new NextRequest("https://carecadence.example/sign-in");
    const first = proxy(request).headers.get("x-request-id");
    const second = proxy(request).headers.get("x-request-id");

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it("redirects protected pages before rendering when no session cookie exists", () => {
    const response = proxy(new NextRequest("https://carecadence.example/app/profile/private"));
    const expectedLocation = new URL(
      "/sign-in?reason=session-required",
      process.env.APP_BASE_URL ?? "https://carecadence.example",
    ).href;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(expectedLocation);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("does not require a session cookie on public pages", () => {
    const response = proxy(new NextRequest("https://carecadence.example/sign-in"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns a hard 404 for the component gallery outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(new NextRequest("https://carecadence.example/dev/components"));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });

  it("allows the component gallery in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = proxy(new NextRequest("https://carecadence.example/dev/components"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
