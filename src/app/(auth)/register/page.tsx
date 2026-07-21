import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, Input } from "@/components/ui/form";
import { routes } from "@/config";
import { safeAppReturnTo } from "@/server/auth/return-to";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const { error, returnTo } = await searchParams;
  const safeReturnTo = safeAppReturnTo(returnTo);
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-3xl">Create your private space</CardTitle>
        <CardDescription>
          Start with your account. Household and profile details come next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error === undefined ? null : (
          <Alert tone="warning" title="Account not created" className="mb-5">
            {error === "rate-limit"
              ? "Too many account attempts were received. Wait a little while before trying again."
              : error === "invalid"
                ? "Check every field, use a password with at least 12 characters, and confirm the notice."
                : "Those details could not be used. Check them or sign in if you already have an account."}
          </Alert>
        )}
        <form action="/api/auth/register" method="post" className="space-y-5">
          {safeReturnTo === null ? null : (
            <input type="hidden" name="returnTo" value={safeReturnTo} />
          )}
          <FormField id="name" label="Name">
            <Input id="name" name="name" autoComplete="name" required maxLength={100} />
          </FormField>
          <FormField id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField
            id="password"
            label="Password"
            hint="Use at least 12 characters. A memorable passphrase works well."
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </FormField>
          <FormField id="passwordConfirmation" label="Confirm password">
            <Input
              id="passwordConfirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </FormField>
          <label className="border-line bg-surface-muted/50 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-5">
            <input
              className="accent-brand mt-1 size-4"
              type="checkbox"
              name="acknowledged"
              value="true"
              required
            />
            <span>
              I understand that CareCadence organizes information and does not replace medical
              advice.
            </span>
          </label>
          <Alert tone="info" title="Adult profiles stay in control">
            Adult profiles can remain private even within a household. Sharing is explicit and can
            be changed.
          </Alert>
          <Button type="submit" size="lg" className="w-full">
            Create account
          </Button>
        </form>
        <p className="text-ink-soft mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link
            className="text-brand-strong font-semibold underline underline-offset-4"
            href={
              safeReturnTo === null
                ? routes.signIn
                : `${routes.signIn}?returnTo=${encodeURIComponent(safeReturnTo)}`
            }
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
