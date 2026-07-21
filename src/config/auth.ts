import type { ServerEnv } from "./env";

export const SESSION_COOKIE_NAME = "carecadence.session";

export function authCookiesAreSecure(environment: {
  NODE_ENV: ServerEnv["NODE_ENV"];
  SESSION_COOKIE_SECURE?: boolean | undefined;
}): boolean {
  return environment.SESSION_COOKIE_SECURE ?? environment.NODE_ENV === "production";
}
