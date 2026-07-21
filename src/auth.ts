import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authCookiesAreSecure, SESSION_COOKIE_NAME } from "@/config/auth";
import { getServerEnv } from "@/config/env";
import { authenticateCredentials } from "@/server/auth/credentials";
import { deleteSessionById, issueSessionToken, sessionTokenClaims } from "@/server/auth/session";

function authConfig(): NextAuthConfig {
  const environment = getServerEnv();
  const maxAge = environment.SESSION_DURATION_DAYS * 86_400;

  return {
    secret: environment.AUTH_SECRET,
    trustHost: environment.AUTH_TRUST_HOST,
    pages: { signIn: "/sign-in" },
    session: { strategy: "jwt", maxAge },
    cookies: {
      sessionToken: {
        name: SESSION_COOKIE_NAME,
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: authCookiesAreSecure(environment),
          priority: "high",
        },
      },
    },
    jwt: {
      async encode({ token, maxAge: requestedMaxAge }) {
        if (token?.sub === undefined) throw new Error("Auth.js did not provide a user identifier.");
        const sessionId = typeof token.jti === "string" ? token.jti : undefined;
        const session = await issueSessionToken(token.sub, {
          ...(sessionId === undefined ? {} : { sessionId }),
          maxAgeSeconds: requestedMaxAge ?? maxAge,
        });
        return session.rawToken;
      },
      async decode({ token }) {
        if (token === undefined) return null;
        const session = await sessionTokenClaims(token);
        if (session === null) return null;
        return {
          sub: session.userId,
          email: session.email,
          name: session.name,
          jti: session.sessionId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(session.expiresAt.getTime() / 1000),
        };
      },
    },
    providers: [
      Credentials({
        name: "Email and password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        authorize: (credentials) => authenticateCredentials(credentials),
      }),
    ],
    events: {
      async signOut(message) {
        if ("token" in message && typeof message.token?.jti === "string") {
          await deleteSessionById(message.token.jti);
        }
      },
    },
  };
}

const authJs = NextAuth(authConfig);

export const auth = authJs.auth;
export const authJsHandlers = authJs.handlers;
export const signInWithAuthJs = authJs.signIn;
export const signOutWithAuthJs = authJs.signOut;
