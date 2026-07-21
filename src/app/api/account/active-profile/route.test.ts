// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/domain/shared/errors";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  setActiveProfileCookie: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/authorization/active-profile", () => ({
  setActiveProfileCookie: mocks.setActiveProfileCookie,
}));

import { POST } from "./route";

const profileId = "90000000-0000-4000-8000-000000000001";
const expiresAt = new Date("2026-08-21T12:00:00.000Z");

describe("POST /api/account/active-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates view access before setting the selection cookie", async () => {
    mocks.requireProfileAccess.mockResolvedValue({
      profile: { id: profileId },
      session: { expiresAt },
    });
    const response = await POST(
      new Request("http://localhost/api/account/active-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith(profileId, "view");
    expect(mocks.setActiveProfileCookie).toHaveBeenCalledWith(profileId, expiresAt);
  });

  it("does not retain an inaccessible selection", async () => {
    mocks.requireProfileAccess.mockRejectedValue(new NotFoundError());
    const response = await POST(
      new Request("http://localhost/api/account/active-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.setActiveProfileCookie).not.toHaveBeenCalled();
  });

  it("redirects form selections into the selected profile", async () => {
    mocks.requireProfileAccess.mockResolvedValue({
      profile: { id: profileId },
      session: { expiresAt },
    });
    const body = new FormData();
    body.set("profileId", profileId);
    const response = await POST(
      new Request("http://localhost/api/account/active-profile", { method: "POST", body }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL(`/app/profile/${profileId}/care-plan`, process.env.APP_BASE_URL ?? "http://localhost")
        .href,
    );
  });
});
