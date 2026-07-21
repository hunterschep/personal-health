import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const result = await prisma.$transaction(async (database) => {
      const deleted = await database.session.deleteMany({
        where: { userId: session.user.id, id: { not: session.sessionId } },
      });
      await database.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "account.other_sessions_revoked",
          entityType: "User",
          entityId: session.user.id,
          metadataJson: { sessionCount: deleted.count },
        },
      });
      return deleted;
    });
    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, revoked: result.count });
    }
    return NextResponse.redirect(appUrl("/app/settings/security?revoked=1", request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
