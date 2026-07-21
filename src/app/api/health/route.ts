import { NextResponse } from "next/server";

import { checkDatabase, checkStorage } from "@/server/health/checks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedMode = new URL(request.url).searchParams.get("mode") ?? "readiness";
  if (requestedMode !== "liveness" && requestedMode !== "readiness") {
    return NextResponse.json(
      { status: "invalid_request", message: "mode must be liveness or readiness" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const baseResponse = {
    status: "ok",
    mode: requestedMode,
    version: process.env.BUILD_VERSION ?? process.env.npm_package_version ?? "development",
    timestamp: new Date().toISOString(),
  };

  if (requestedMode === "liveness") {
    return NextResponse.json(baseResponse, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [database, storage] = await Promise.all([
    import("@/server/db/client")
      .then(({ prisma }) => checkDatabase(prisma))
      .catch(() => "error" as const),
    checkStorage(process.env.UPLOAD_DIR ?? "./uploads"),
  ]);
  const ready = database === "ok" && storage === "ok";

  return NextResponse.json(
    {
      ...baseResponse,
      status: ready ? "ok" : "unavailable",
      checks: { database, storage },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        ...(ready ? {} : { "Retry-After": "10" }),
      },
    },
  );
}
