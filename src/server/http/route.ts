import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/domain/shared/errors";

export function routeError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Check the highlighted information and try again.",
        fieldErrors: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof RangeError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}

export function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

export function dateOnly(value: string | null | undefined): Date | null {
  return value === null || value === undefined || value === ""
    ? null
    : new Date(`${value}T00:00:00.000Z`);
}
