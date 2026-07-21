import { NextResponse } from "next/server";
import { dateInTimeZone } from "@/domain/dates";

import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import {
  decodeCsv,
  importTokenHash,
  MAX_CSV_BYTES,
  parseCsv,
  resolveImportRowsForProfile,
  signImportPayload,
} from "@/server/imports";

function safeFilename(value: string): string {
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return (normalized === "" ? "care-events.csv" : normalized).slice(0, 255);
}

function firstMessage(errors: readonly string[], warnings: readonly string[]): string {
  return errors[0] ?? warnings[0] ?? "Ready to import.";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { profile, session } = await requireProfileAccess(profileId, "edit");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new RangeError("Choose a non-empty CSV file.");
    }
    if (file.size > MAX_CSV_BYTES) {
      throw new RangeError(`CSV files are limited to ${Math.floor(MAX_CSV_BYTES / 1_048_576)} MB.`);
    }

    const today = dateInTimeZone(new Date(), profile.timezone);
    const parsed = parseCsv(decodeCsv(new Uint8Array(await file.arrayBuffer())), today);
    const rows = await resolveImportRowsForProfile(profile.id, parsed);
    const validCount = rows.filter((row) => row.errors.length === 0).length;
    const errorCount = rows.length - validCount;
    const batch = await prisma.importBatch.create({
      data: {
        profileId: profile.id,
        uploadedByUserId: session.user.id,
        filename: safeFilename(file.name),
        status: "previewing",
        rowCount: rows.length,
        validCount,
        errorCount,
      },
    });
    const token = await signImportPayload({
      batchId: batch.id,
      profileId: profile.id,
      userId: session.user.id,
      rows,
    });
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "ready", commitTokenHash: importTokenHash(token) },
    });

    return NextResponse.json(
      {
        token,
        batchId: batch.id,
        rows: rows.map((row) => ({
          row: row.rowNumber,
          service: row.service,
          date: row.date ?? "Date unknown",
          status: row.errors.length > 0 ? "error" : row.warnings.length > 0 ? "warning" : "valid",
          message: firstMessage(row.errors, row.warnings),
          errors: row.errors,
          warnings: row.warnings,
          possibleDuplicateIds: row.possibleDuplicateIds,
        })),
        validCount,
        warningCount: rows.filter((row) => row.errors.length === 0 && row.warnings.length > 0)
          .length,
        errorCount,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
