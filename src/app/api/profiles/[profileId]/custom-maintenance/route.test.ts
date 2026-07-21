import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/domain/shared/errors";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));

import { POST } from "./route";

describe("custom maintenance route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks same-origin and edit access before starting a mutation", async () => {
    mocks.requireProfileAccess.mockRejectedValue(new NotFoundError());
    const response = await POST(
      new Request("http://localhost/api/profiles/private/custom-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
      { params: Promise.resolve({ profileId: "private" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.assertSameOrigin).toHaveBeenCalledTimes(1);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("private", "edit");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

function validPayload() {
  return {
    title: "Dental care",
    category: "Dental",
    source: "personal",
    reminderEnabled: false,
  };
}
