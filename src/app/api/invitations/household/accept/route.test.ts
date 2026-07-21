// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireSession: vi.fn(),
  acceptHouseholdInvitation: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/invitations", () => ({
  acceptHouseholdInvitation: mocks.acceptHouseholdInvitation,
}));

import { POST } from "./route";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("household invitation body acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({
      user: { id: "user-id", email: "invited@example.com" },
    });
    mocks.acceptHouseholdInvitation.mockResolvedValue({ householdId: "household-id" });
  });

  it("keeps the raw token out of the acceptance URL", async () => {
    const form = new FormData();
    form.set("token", token);
    const response = await POST(
      new Request("http://localhost/api/invitations/household/accept", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL("/app/family", process.env.APP_BASE_URL ?? "http://localhost").href,
    );
    expect(response.url).not.toContain(token);
    expect(mocks.acceptHouseholdInvitation).toHaveBeenCalledWith(token, {
      id: "user-id",
      email: "invited@example.com",
    });
  });
});
