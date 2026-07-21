import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, Input } from "@/components/ui/form";
import { capabilitiesFromEnvironment } from "@/config/capabilities";
import { getServerEnv } from "@/config/env";

export const metadata: Metadata = { title: "Recover account" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  const smtpConfigured = capabilitiesFromEnvironment(getServerEnv()).smtpConfigured;
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-3xl">Recover your account</CardTitle>
        <CardDescription>
          {smtpConfigured
            ? "Request a private, expiring password-reset link."
            : "This self-hosted service does not have email delivery configured."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {sent === "1" ? (
          <Alert tone="success" title="Check your email">
            If an active account matches and email delivery is available, a reset link has been
            sent.
          </Alert>
        ) : null}
        {smtpConfigured ? (
          <form action="/api/auth/password-reset/request" method="post" className="space-y-5">
            <FormField id="email" label="Email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </FormField>
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        ) : (
          <Alert tone="info" title="Contact the local administrator">
            The operator can use the documented owner-only recovery command. Passwords should never
            be sent through support messages or command arguments.
          </Alert>
        )}
        <Link className="text-brand-strong text-sm font-semibold underline" href="/sign-in">
          Return to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
