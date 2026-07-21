import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { dispatchDueReminders } from "@/server/reminders";

function authorized(request: Request): boolean {
  const configured = process.env.REMINDER_DISPATCH_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (configured === undefined || configured.length < 32 || provided === undefined) return false;
  const expectedBytes = Buffer.from(configured);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "This resource is not available." }, { status: 404 });
  }
  try {
    const result = await dispatchDueReminders({ batchSize: 100 });
    return NextResponse.json({
      scanned: result.scanned,
      sent: result.sentIds.length,
      failed: result.failedIds.length,
      skipped: result.skippedIds.length,
      unavailable: result.unavailable,
    });
  } catch {
    return NextResponse.json({ error: "Reminder dispatch failed." }, { status: 503 });
  }
}
