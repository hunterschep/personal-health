import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/server/db/transactions";
import { normalizeProfileHealthContext, synchronizeProfileHealthContext } from "./health-context";

describe("profile health-context synchronization", () => {
  it("reuses one canonical row, soft-deletes duplicates, and clears removed context", async () => {
    const riskUpdate = vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
    const riskUpdateMany = vi.fn(async () => ({ count: 1 }));
    const conditionUpdate = vi.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    }));
    const conditionUpdateMany = vi.fn(async () => ({ count: 1 }));
    const familyUpdate = vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
    const familyUpdateMany = vi.fn(async () => ({ count: 1 }));
    const surgeryUpdateMany = vi.fn(async () => ({ count: 1 }));
    const database = {
      riskFactor: {
        findMany: vi.fn(async ({ where }: { where: { type: string } }) =>
          where.type === "tobacco_use"
            ? [
                { id: "tobacco-current", deletedAt: null },
                { id: "tobacco-duplicate", deletedAt: null },
              ]
            : where.type === "height_weight"
              ? [{ id: "height-old", deletedAt: null }]
              : [{ id: "immune-old", deletedAt: new Date("2025-01-01") }],
        ),
        create: vi.fn(async () => ({ id: "risk-new" })),
        update: riskUpdate,
        updateMany: riskUpdateMany,
      },
      condition: {
        findMany: vi.fn(async () => [
          { id: "hypertension-current", code: "hypertension", deletedAt: null },
          { id: "hypertension-duplicate", code: "hypertension", deletedAt: null },
          { id: "diabetes-current", code: "diabetes", deletedAt: null },
        ]),
        create: vi.fn(async () => ({ id: "condition-new" })),
        update: conditionUpdate,
        updateMany: conditionUpdateMany,
      },
      familyHistory: {
        findMany: vi.fn(async () => [{ id: "family-current" }, { id: "family-duplicate" }]),
        create: vi.fn(async () => ({ id: "family-new" })),
        update: familyUpdate,
        updateMany: familyUpdateMany,
      },
      surgery: {
        findMany: vi.fn(async () => [{ id: "surgery-current" }]),
        create: vi.fn(async () => ({ id: "surgery-new" })),
        update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
        updateMany: surgeryUpdateMany,
      },
    } as unknown as DatabaseClient;
    const context = normalizeProfileHealthContext(
      {
        tobaccoStatus: "former",
        smokingStartYear: "2000",
        smokingEndYear: "2010",
        packsPerDay: "1",
        heightInches: "",
        weightPounds: "",
        immunocompromised: "no",
        conditions: { hypertension: true },
        familyHistoryNote: "Parent — colorectal cancer",
        surgeryNote: "",
      },
      { dateOfBirth: "1980-05-12", measuredOn: "2026-07-21" },
    );

    const counts = await synchronizeProfileHealthContext(
      database,
      "profile-1",
      context,
      new Date("2026-07-21T00:00:00.000Z"),
    );

    expect(counts).toEqual({ riskFactorCount: 6, conditionCount: 1, narrativeContextCount: 1 });
    expect(riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tobacco-current" },
        data: expect.objectContaining({ deletedAt: null, endedAt: null }),
      }),
    );
    expect(riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "immune-old" },
        data: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(riskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "height_weight", deletedAt: null }),
      }),
    );
    expect(conditionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "hypertension-current" } }),
    );
    expect(conditionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: "diabetes", deletedAt: null }),
      }),
    );
    expect(familyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "family-current" } }),
    );
    expect(familyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "family-current" } }),
      }),
    );
    expect(surgeryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
