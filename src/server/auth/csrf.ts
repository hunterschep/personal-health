import { AuthorizationError } from "@/domain/shared/errors";

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    (new URL(request.url).protocol.replace(":", "") || "https");

  if (origin === null || host === null) {
    throw new AuthorizationError();
  }

  const expected = normalizeOrigin(`${protocol}://${host}`);
  if (normalizeOrigin(origin) !== expected) {
    throw new AuthorizationError();
  }
}
