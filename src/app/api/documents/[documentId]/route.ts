import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { NotFoundError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { deleteDocumentBlobs, privateStorage } from "@/server/storage";

function disposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

async function auditIntegrityFailure(
  document: { id: string; householdId: string; profileId: string },
  actorUserId: string,
  reason: "size_mismatch" | "hash_mismatch",
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      householdId: document.householdId,
      profileId: document.profileId,
      actorUserId,
      action: "document.integrity_failed",
      entityType: "Document",
      entityId: document.id,
      metadataJson: { reason },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (document === null) return notFoundResponse();
    const { session } = await requireProfileAccess(document.profileId, "view");
    const stored = await privateStorage.get(document.storageKey);
    const expectedSize = Number(document.sizeBytes);
    if (!Number.isSafeInteger(expectedSize) || stored.size !== expectedSize) {
      await auditIntegrityFailure(document, session.user.id, "size_mismatch");
      return NextResponse.json(
        { error: "The stored document failed its integrity check." },
        { status: 409 },
      );
    }
    const chunks: Buffer[] = [];
    let received = 0;
    let oversized = false;
    for await (const chunk of stored.stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += bytes.length;
      if (received > expectedSize) {
        oversized = true;
        break;
      }
      chunks.push(bytes);
    }
    if (oversized || received !== expectedSize) {
      await auditIntegrityFailure(document, session.user.id, "size_mismatch");
      return NextResponse.json(
        { error: "The stored document failed its integrity check." },
        { status: 409 },
      );
    }
    const contents = Buffer.concat(chunks);
    const digest = createHash("sha256").update(contents).digest("hex");
    if (digest !== document.sha256) {
      await auditIntegrityFailure(document, session.user.id, "hash_mismatch");
      return NextResponse.json(
        { error: "The stored document failed its integrity check." },
        { status: 409 },
      );
    }
    await prisma.auditLog.create({
      data: {
        householdId: document.householdId,
        profileId: document.profileId,
        actorUserId: session.user.id,
        action: "document.downloaded",
        entityType: "Document",
        entityId: document.id,
        metadataJson: {},
      },
    });
    return new Response(contents, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(contents.length),
        "Content-Disposition": disposition(document.safeFilename),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return notFoundResponse();
    return routeError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { documentId } = await params;
    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (document === null) return notFoundResponse();
    const { session } = await requireProfileAccess(document.profileId, "edit");
    await prisma.$transaction([
      prisma.document.update({ where: { id: document.id }, data: { deletedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          householdId: document.householdId,
          profileId: document.profileId,
          actorUserId: session.user.id,
          action: "document.deleted",
          entityType: "Document",
          entityId: document.id,
          metadataJson: {},
        },
      }),
    ]);
    const cleanup = await deleteDocumentBlobs([
      {
        id: document.id,
        storageKey: document.storageKey,
        householdId: document.householdId,
        profileId: document.profileId,
      },
    ]);
    if (cleanup.failedIds.length > 0) {
      return NextResponse.json({ ok: true, cleanupPending: true }, { status: 202 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFoundError) return notFoundResponse();
    return routeError(error);
  }
}
