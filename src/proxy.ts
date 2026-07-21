import { randomBytes } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { isComponentGalleryEnabled } from "@/components/gallery/gallery-access";
import { SESSION_COOKIE_NAME } from "@/config/auth";
import { appUrl } from "@/server/http/app-url";
import { createRequestId, REQUEST_ID_HEADER } from "@/server/http/request-id";
import { createContentSecurityPolicy } from "@/server/security/headers";

export function proxy(request: NextRequest): NextResponse {
  const nonce = randomBytes(16).toString("base64");
  const requestId = createRequestId();
  const policy = createContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("Content-Security-Policy", policy);

  if (
    request.nextUrl.pathname.startsWith("/dev/components") &&
    !isComponentGalleryEnabled(process.env.NODE_ENV)
  ) {
    const response = new NextResponse(null, { status: 404 });
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const protectedPath =
    request.nextUrl.pathname === "/app" || request.nextUrl.pathname.startsWith("/app/");
  if (protectedPath && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const signInUrl = appUrl("/sign-in", request.url);
    signInUrl.searchParams.set("reason", "session-required");
    const response = NextResponse.redirect(signInUrl);
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|offline.html|sw.js).*)",
  ],
};
