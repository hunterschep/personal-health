import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, Input } from "@/components/ui/form";
import { routes } from "@/config";
import { safeAppReturnTo } from "@/server/auth/return-to";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reason?: string; error?: string }>;
}) {
  const { returnTo, reason, error } = await searchParams;
  const safeReturnTo = safeAppReturnTo(returnTo);
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-3xl">Welcome back</CardTitle>
        <CardDescription>Sign in to open your private care plan.</CardDescription>
      </CardHeader>
      <CardContent>
        {reason === "session-required" ? (
          <Alert tone="info" title="Sign in required" className="mb-5">
            Sign in to open that private page.
          </Alert>
        ) : null}
        {error === undefined ? null : (
          <Alert
            tone="warning"
            title={error === "rate-limit" ? "Try again later" : "Sign-in unsuccessful"}
            className="mb-5"
          >
            {error === "rate-limit"
              ? "Too many attempts were received. Wait a little while before trying again."
              : "The email or password did not match an active account."}
          </Alert>
        )}
        <form action="/api/auth/sign-in" method="post" className="space-y-5">
          {safeReturnTo === null ? null : (
            <input type="hidden" name="returnTo" value={safeReturnTo} />
          )}
          <FormField id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField id="password" label="Password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link className="text-brand-strong font-semibold underline" href="/forgot-password">
            Forgot your password?
          </Link>
        </p>
        <p className="text-ink-soft mt-6 text-center text-sm">
          New to CareCadence?{" "}
          <Link
            className="text-brand-strong font-semibold underline underline-offset-4"
            href={
              safeReturnTo === null
                ? routes.register
                : `${routes.register}?returnTo=${encodeURIComponent(safeReturnTo)}`
            }
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
