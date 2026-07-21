import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { getServerEnv } from "@/config/env";

import { MAX_CSV_TOKEN_BYTES, type SignedImportPayload } from "./types";

const rowSchema = z.object({
  rowNumber: z.number().int().positive(),
  service: z.string().max(160),
  method: z.string().max(160).nullable(),
  date: z.string().max(10).nullable(),
  datePrecision: z.enum(["day", "month", "year", "unknown"]),
  result: z.enum(["normal", "abnormal", "inconclusive", "unknown", "not_applicable"]),
  provider: z.string().max(120).nullable(),
  location: z.string().max(160).nullable(),
  source: z.enum(["user_memory", "medical_record", "clinician", "pharmacy", "csv_import"]),
  notes: z.string().max(2_000).nullable(),
  performedStart: z.string().max(10).nullable(),
  performedEnd: z.string().max(10).nullable(),
  serviceId: z.uuid().nullable(),
  methodId: z.uuid().nullable(),
  errors: z.array(z.string().max(300)).max(20),
  warnings: z.array(z.string().max(300)).max(20),
  possibleDuplicateIds: z.array(z.string().max(100)).max(50),
});

const payloadSchema = z.object({
  kind: z.literal("carecadence.csv-import.v1"),
  batchId: z.uuid(),
  profileId: z.uuid(),
  userId: z.uuid(),
  rows: z.array(rowSchema).max(1_000),
});

function secret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().AUTH_SECRET);
}

export function importTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function signImportPayload(payload: SignedImportPayload): Promise<string> {
  const token = await new SignJWT({ kind: "carecadence.csv-import.v1", ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret());
  if (Buffer.byteLength(token, "utf8") > MAX_CSV_TOKEN_BYTES) {
    throw new RangeError("The normalized import is too large. Split the CSV into smaller files.");
  }
  return token;
}

export async function verifyImportToken(token: string): Promise<SignedImportPayload> {
  if (Buffer.byteLength(token, "utf8") > MAX_CSV_TOKEN_BYTES) {
    throw new RangeError("The import token is too large.");
  }
  try {
    const verified = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      typ: "JWT",
    });
    const parsed = payloadSchema.parse(verified.payload);
    return {
      batchId: parsed.batchId,
      profileId: parsed.profileId,
      userId: parsed.userId,
      rows: parsed.rows,
    };
  } catch {
    throw new RangeError("The import preview has expired or is not valid. Preview the file again.");
  }
}
