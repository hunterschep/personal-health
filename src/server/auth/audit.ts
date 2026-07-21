import { createHash } from "node:crypto";
import { prisma } from "@/server/db/client";

export async function writeAuthAudit(
  action: string,
  actorUserId: string | null,
  request: Request,
): Promise<void> {
  const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = rawIp === undefined ? null : createHash("sha256").update(rawIp).digest("hex");
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType: "User",
      entityId: actorUserId ?? "anonymous",
      metadataJson: {},
      ipHash,
      userAgentFamily: request.headers.get("user-agent")?.slice(0, 120) ?? null,
    },
  });
}
