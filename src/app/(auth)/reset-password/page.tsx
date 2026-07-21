import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, Input } from "@/components/ui/form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  const validTokenShape = token !== undefined && /^[A-Za-z0-9_-]{32,128}$/.test(token);
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-3xl">Choose a new password</CardTitle>
        <CardDescription>The link works once and expires after one hour.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {status !== undefined || !validTokenShape ? (
          <Alert tone="warning" title="Request a new link">
            {status === "rate-limit"
              ? "Too many attempts were received. Wait before trying again."
              : "This reset link is missing, expired, or already used."}
          </Alert>
        ) : (
          <form action="/api/auth/password-reset/complete" method="post" className="space-y-5">
            <input type="hidden" name="token" value={token} />
            <FormField id="password" label="New password" hint="Use at least 12 characters.">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </FormField>
            <FormField id="confirmation" label="Confirm new password">
              <Input
                id="confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </FormField>
            <Button type="submit" className="w-full">
              Reset password
            </Button>
          </form>
        )}
        <Link className="text-brand-strong text-sm font-semibold underline" href="/forgot-password">
          Request another link
        </Link>
      </CardContent>
    </Card>
  );
}
