import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import { NextResponse } from "next/server";
import sanitizeFilename from "sanitize-filename";
import { z } from "zod";
import { getServerEnv } from "@/config/env";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { privateStorage } from "@/server/storage/local";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const targetSchema = z
  .object({
    medicationId: z.union([z.literal(""), z.uuid()]).default(""),
    clinicianOverrideId: z.union([z.literal(""), z.uuid()]).default(""),
    label: z.string().trim().min(1).max(120).default("Supporting document"),
  })
  .refine(
    (input) => Number(input.medicationId !== "") + Number(input.clinicianOverrideId !== "") <= 1,
    { message: "Choose only one document link target." },
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const form = await request.formData();
    const target = targetSchema.parse({
      medicationId: String(form.get("medicationId") ?? ""),
      clinicianOverrideId: String(form.get("clinicianOverrideId") ?? ""),
      label: String(form.get("label") ?? "Supporting document"),
    });
    if (target.medicationId !== "") {
      const medication = await prisma.medication.findFirst({
        where: { id: target.medicationId, profileId: profile.id, deletedAt: null },
        select: { id: true },
      });
      if (medication === null) {
        return NextResponse.json(
          { error: "The document link target was not found." },
          { status: 404 },
        );
      }
    }
    if (target.clinicianOverrideId !== "") {
      const override = await prisma.clinicianOverride.findFirst({
        where: { id: target.clinicianOverrideId, profileId: profile.id },
        select: { id: true },
      });
      if (override === null) {
        return NextResponse.json(
          { error: "The document link target was not found." },
          { status: 404 },
        );
      }
    }
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "Choose a document." }, { status: 400 });

    const environment = getServerEnv();
    if (file.size <= 0 || file.size > environment.MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Documents must be smaller than ${environment.MAX_UPLOAD_BYTES} bytes.` },
        { status: 413 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(bytes);
    if (
      detected === undefined ||
      !allowedTypes.has(detected.mime) ||
      !allowedTypes.has(file.type)
    ) {
      return NextResponse.json(
        { error: "Only genuine PDF, JPEG, and PNG documents are accepted." },
        { status: 415 },
      );
    }

    const stored = await privateStorage.put({
      stream: Readable.from(bytes),
      contentType: detected.mime,
      size: bytes.length,
    });
    const safeFilename =
      sanitizeFilename(file.name, { replacement: "_" }).slice(0, 255) || "document";
    try {
      const document = await prisma.$transaction(async (database) => {
        const created = await database.document.create({
          data: {
            householdId: profile.householdId,
            profileId,
            storageKey: stored.storageKey,
            originalFilename: file.name.slice(0, 255),
            safeFilename,
            mimeType: detected.mime,
            sizeBytes: BigInt(bytes.length),
            sha256: stored.sha256,
            uploadedByUserId: session.user.id,
          },
        });
        if (target.medicationId !== "" || target.clinicianOverrideId !== "") {
          await database.documentLink.create({
            data: {
              documentId: created.id,
              medicationId: target.medicationId || null,
              clinicianOverrideId: target.clinicianOverrideId || null,
              label: target.label,
            },
          });
        }
        await database.auditLog.create({
          data: {
            householdId: profile.householdId,
            profileId,
            actorUserId: session.user.id,
            action: "document.uploaded",
            entityType: "Document",
            entityId: created.id,
            metadataJson: { mimeType: detected.mime, sizeBytes: bytes.length },
          },
        });
        return created;
      });
      return NextResponse.json(
        {
          id: document.id,
          filename: document.safeFilename,
          size: Number(document.sizeBytes),
          mimeType: document.mimeType,
        },
        { status: 201 },
      );
    } catch (error) {
      await privateStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "The document could not be uploaded." }, { status: 400 });
  }
}
