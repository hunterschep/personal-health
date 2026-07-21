import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { capabilitiesFromEnvironment } from "@/config/capabilities";
import { getServerEnv } from "@/config/env";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Confirm email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string; pending?: string }>;
}) {
  const { token, status, pending } = await searchParams;
  const session = await getSession();
  const smtpConfigured = capabilitiesFromEnvironment(getServerEnv()).smtpConfigured;
  const validTokenShape = token !== undefined && /^[A-Za-z0-9_-]{32,128}$/.test(token);
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-3xl">Confirm your email</CardTitle>
        <CardDescription>
          Email confirmation protects invitations addressed to a specific adult.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {status === "sent" || pending === "1" ? (
          <Alert tone="success" title="Confirmation sent">
            Open the private link in your email. It expires after 24 hours.
          </Alert>
        ) : null}
        {status === "verified" ? (
          <Alert tone="success" title="Already confirmed">
            This account’s email is already confirmed.
          </Alert>
        ) : null}
        {status === "invalid" ? (
          <Alert tone="warning" title="Link unavailable">
            The confirmation link is expired, already used, or invalid. Request another below.
          </Alert>
        ) : null}
        {validTokenShape ? (
          <form action="/api/auth/email-verification/confirm" method="post">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" className="w-full">
              Confirm email
            </Button>
          </form>
        ) : null}
        {smtpConfigured && session !== null ? (
          <form action="/api/auth/email-verification/request" method="post">
            <Button type="submit" variant="secondary" className="w-full">
              Send a new confirmation link
            </Button>
          </form>
        ) : null}
        <Link
          className="text-brand-strong text-sm font-semibold underline"
          href={session ? "/app" : "/sign-in"}
        >
          {session ? "Return to CareCadence" : "Return to sign in"}
        </Link>
      </CardContent>
    </Card>
  );
}
