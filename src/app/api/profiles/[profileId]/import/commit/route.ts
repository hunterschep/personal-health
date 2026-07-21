import { NextResponse } from "next/server";
import { z } from "zod";

import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { Prisma } from "@/generated/prisma/client";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { importTokenHash, verifyImportToken } from "@/server/imports";
import { careEventFingerprint } from "@/server/repositories/care-event";
import { rebuildRecommendations } from "@/server/recommendations";

const commitSchema = z.object({
  token: z
    .string()
    .min(40)
    .max(3 * 1024 * 1024),
  includeWarningRows: z.boolean().default(false),
  includeWarningRowNumbers: z.array(z.number().int().positive()).max(1_000).default([]),
  includeRowNumbers: z.array(z.number().int().positive()).max(1_000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "edit");
    const input = commitSchema.parse(await request.json());
    const payload = await verifyImportToken(input.token);
    if (payload.profileId !== profile.id || payload.userId !== session.user.id)
      throw new NotFoundError();
    let selectedRows: typeof payload.rows;
    if (input.includeRowNumbers === undefined) {
      if (payload.rows.some((row) => row.errors.length > 0)) {
        throw new ValidationError(
          "Resolve every CSV error and preview the file again before importing.",
        );
      }
      const selectedWarningRows = new Set(input.includeWarningRowNumbers);
      selectedRows = payload.rows.filter(
        (row) =>
          row.warnings.length === 0 ||
          input.includeWarningRows ||
          selectedWarningRows.has(row.rowNumber),
      );
    } else {
      const requestedRows = new Set(input.includeRowNumbers);
      if (
        input.includeRowNumbers.some(
          (rowNumber) => !payload.rows.some((row) => row.rowNumber === rowNumber),
        )
      ) {
        throw new ValidationError("One or more selected preview rows are not available.");
      }
      selectedRows = payload.rows.filter((row) => requestedRows.has(row.rowNumber));
      if (selectedRows.some((row) => row.errors.length > 0)) {
        throw new ValidationError("Rows with errors cannot be imported.");
      }
    }
    if (selectedRows.length === 0) {
      throw new ValidationError("Choose at least one preview row to import.");
    }
    const tokenHash = importTokenHash(input.token);

    const result = await prisma.$transaction(
      async (database) => {
        await database.$queryRaw(
          Prisma.sql`SELECT "id" FROM "ImportBatch" WHERE "id" = ${payload.batchId} FOR UPDATE`,
        );
        const batch = await database.importBatch.findFirst({
          where: {
            id: payload.batchId,
            profileId: profile.id,
            uploadedByUserId: session.user.id,
            commitTokenHash: tokenHash,
          },
        });
        if (batch === null) throw new NotFoundError();
        if (batch.status === "committed") {
          return {
            importedCount: await database.careEvent.count({ where: { importBatchId: batch.id } }),
            idempotent: true,
          };
        }
        if (batch.status !== "ready") {
          throw new ValidationError("This import preview is not ready to commit.");
        }

        await database.importBatch.update({
          where: { id: batch.id },
          data: { status: "committing" },
        });
        const records = selectedRows.map((row) => {
          if (row.serviceId === null)
            throw new ValidationError("A CSV service could not be resolved.");
          const record = {
            profileId: profile.id,
            serviceId: row.serviceId,
            methodId: row.methodId,
            performedStart:
              row.performedStart === null ? null : new Date(`${row.performedStart}T00:00:00.000Z`),
            performedEnd:
              row.performedEnd === null ? null : new Date(`${row.performedEnd}T00:00:00.000Z`),
            datePrecision: row.datePrecision,
            result: row.result,
            providerName: row.provider,
            locationName: row.location,
            notes: row.notes,
            source: row.source,
            importBatchId: batch.id,
            createdByUserId: session.user.id,
          } as const;
          return { ...record, duplicateFingerprint: careEventFingerprint(record) };
        });
        await database.careEvent.createMany({ data: records });
        await rebuildRecommendations(database, profile.id, undefined, {
          actorUserId: session.user.id,
          reason: "care_event_created",
        });
        await database.importBatch.update({
          where: { id: batch.id },
          data: { status: "committed", committedAt: new Date(), validCount: records.length },
        });
        await database.auditLog.create({
          data: {
            householdId: profile.householdId,
            profileId: profile.id,
            actorUserId: session.user.id,
            action: "care_events.imported",
            entityType: "ImportBatch",
            entityId: batch.id,
            metadataJson: { rowCount: records.length },
          },
        });
        return { importedCount: records.length, idempotent: false };
      },
      { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 30_000 },
    );

    return NextResponse.json(
      { ok: true, batchId: payload.batchId, ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
