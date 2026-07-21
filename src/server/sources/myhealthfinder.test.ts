import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  buildMyHealthfinderUrl,
  createMyHealthfinderCacheKey,
  MyHealthfinderClient,
  toAnonymousMyHealthfinderInput,
} from "./myhealthfinder";
import { jsonResponse, myHealthfinderPayload } from "./test-fixtures.test-helper";

describe("MyHealthfinder anonymous client", () => {
  it("derives age locally and transmits only the explicit anonymous allowlist", async () => {
    const requestedUrls: string[] = [];
    const request = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(input instanceof Request ? input.url : input.toString());
      return jsonResponse(myHealthfinderPayload());
    });
    const converted = toAnonymousMyHealthfinderInput(
      {
        dateOfBirth: "1980-07-22",
        sexAssignedAtBirth: "female",
        pregnant: "no",
        sexuallyActive: "yes",
        tobaccoUse: "no",
        language: "en",
      },
      "2026-07-21",
    );
    expect(converted).toMatchObject({ eligible: true, input: { age: 45 } });
    if (!converted.eligible) return;

    const client = new MyHealthfinderClient({
      fetch: request,
      now: () => new Date("2026-07-21T12:00:00.000Z"),
      maxRetries: 0,
    });
    await client.fetch(converted.input);

    const requestedUrl = new URL(requestedUrls[0]!);
    expect([...requestedUrl.searchParams.keys()].sort()).toEqual([
      "age",
      "pregnant",
      "sex",
      "sexuallyActive",
      "tobaccoUse",
    ]);
    expect(requestedUrl.toString()).not.toContain("1980-07-22");
    expect(requestedUrl.toString()).not.toMatch(
      /name|email|profile|household|medication|note|document/i,
    );
  });

  it("rejects extra PII fields before any request is sent", async () => {
    const request = vi.fn(async () => jsonResponse(myHealthfinderPayload()));
    const client = new MyHealthfinderClient({ fetch: request, maxRetries: 0 });
    const maliciousInput = {
      age: 45,
      sex: "female" as const,
      language: "en" as const,
      name: "Synthetic Person",
      email: "synthetic@example.test",
      profileId: "private-id",
      notes: "private note",
      medications: ["private medication"],
      attachment: "private.pdf",
    };

    await expect(client.fetch(maliciousInput)).rejects.toBeInstanceOf(z.ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it("uses a deterministic cache key composed from the normalized anonymous tuple", () => {
    const first = createMyHealthfinderCacheKey({
      age: 35,
      sex: "female",
      pregnant: "no",
      language: "en",
    });
    const second = createMyHealthfinderCacheKey({
      language: "en",
      pregnant: "no",
      sex: "female",
      age: 35,
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^myhealthfinder:v4:[a-f0-9]{64}$/);
    expect(first).not.toContain("35");
  });

  it("retries bounded transient responses and respects Retry-After", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "retry-after": "1" }))
      .mockResolvedValueOnce(jsonResponse(myHealthfinderPayload()));
    const sleep = vi.fn(async () => undefined);
    const client = new MyHealthfinderClient({
      fetch: request,
      sleep,
      maxRetries: 2,
      maxRetryDelayMs: 2_000,
      now: () => new Date("2026-07-21T12:00:00.000Z"),
    });

    const result = await client.fetch({ age: 35, sex: "female", language: "en" });
    expect(result.httpStatus).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("does not retry permanent failures and rejects malformed content", async () => {
    const permanentRequest = vi.fn(async () => jsonResponse({}, 400));
    const client = new MyHealthfinderClient({ fetch: permanentRequest, maxRetries: 2 });
    await expect(client.fetch({ age: 35, sex: "female" })).rejects.toThrow(/status 400/);
    expect(permanentRequest).toHaveBeenCalledTimes(1);

    const malformedClient = new MyHealthfinderClient({
      fetch: async () => jsonResponse({ Result: { Error: "False" } }),
      maxRetries: 0,
    });
    await expect(malformedClient.fetch({ age: 35, sex: "female" })).rejects.toThrow(
      /temporarily unavailable/i,
    );
  });

  it("aborts a request that exceeds the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn(
        async (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      );
      const client = new MyHealthfinderClient({ fetch: request, timeoutMs: 50, maxRetries: 0 });
      const result = client.fetch({ age: 35, sex: "female" });
      const expectation = expect(result).rejects.toThrow(/temporarily unavailable/i);
      await vi.advanceTimersByTimeAsync(51);
      await expectation;
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never supports profile identifiers in its URL builder", () => {
    const url = buildMyHealthfinderUrl({ age: 57, sex: "male", tobaccoUse: "no" });
    expect(url.origin).toBe("https://odphp.health.gov");
    expect([...url.searchParams.keys()]).toEqual(["age", "sex", "tobaccoUse"]);
  });
});
