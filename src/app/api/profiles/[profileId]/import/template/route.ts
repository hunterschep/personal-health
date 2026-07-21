import { NextResponse } from "next/server";

import { requireProfileAccess } from "@/server/authorization/profile";
import { routeError } from "@/server/http";
import { csvTemplate } from "@/server/imports";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    await requireProfileAccess(profileId, "view");
    return new NextResponse(csvTemplate(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="carecadence-care-events-template.csv"',
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
