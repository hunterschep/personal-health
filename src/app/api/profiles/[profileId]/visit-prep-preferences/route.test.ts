// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: { visitPrepPreference: { upsert: mocks.upsert } },
}));

import { PATCH } from "./route";

describe("visit-prep preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: { id: "profile-1" },
    });
    mocks.upsert.mockResolvedValue({ id: "preference-1" });
  });

  it("persists the viewer's selected sections, questions, and personal notes", async () => {
    const sections = {
      appointments: true,
      medications: true,
      conditions: true,
      attention: true,
      thisYear: false,
      unknown: true,
      discussion: true,
      clinician: true,
      recentEvents: true,
      personalNotes: true,
    };
    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1/visit-prep-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "extended",
          sections,
          questions: ["Which timing should we discuss first?"],
          personalNotes: "Ask about travel timing.",
        }),
      }),
      { params: Promise.resolve({ profileId: "profile-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-1", "edit");
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { userId_profileId: { userId: "user-1", profileId: "profile-1" } },
      create: expect.objectContaining({
        userId: "user-1",
        profileId: "profile-1",
        mode: "extended",
        sectionsJson: sections,
        questionsJson: ["Which timing should we discuss first?"],
        personalNotes: "Ask about travel timing.",
      }),
      update: expect.objectContaining({
        sectionsJson: sections,
        personalNotes: "Ask about travel timing.",
      }),
    });
  });
});
