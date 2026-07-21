import { NextResponse } from "next/server";

import { NotFoundError } from "@/domain/shared/errors";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";
import { verifyReminderLink } from "@/server/reminders";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const token = new URL(request.url).searchParams.get("token");
    if (token === null || token.length > 2_000) throw new NotFoundError();
    const payload = await verifyReminderLink(token);
    if (payload.userId !== session.user.id) throw new NotFoundError();
    const reminder = await prisma.reminder.findFirst({
      where: { id: payload.reminderId, profile: { ownerUserId: session.user.id, deletedAt: null } },
      select: { id: true },
    });
    if (reminder === null) throw new NotFoundError();
    return NextResponse.redirect(appUrl(`/app/reminders?focus=${reminder.id}`, request.url), 303);
  } catch (error) {
    return routeError(error);
  }
}
