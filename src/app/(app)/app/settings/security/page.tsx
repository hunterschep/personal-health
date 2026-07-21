import { KeyRound, LogOut, MailCheck, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  PasswordChangeForm,
  RevokeOtherSessionsButton,
} from "@/components/settings/security-controls";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { capabilitiesFromEnvironment } from "@/config/capabilities";
import { getServerEnv } from "@/config/env";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

export default async function SecurityPage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  const emailVerificationEnabled = capabilitiesFromEnvironment(getServerEnv()).smtpConfigured;
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account protection"
        title="Security"
        description="Change the password, rotate sessions, or sign out. Health details never appear in authentication logs."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent>
            <KeyRound aria-hidden="true" className="text-brand size-5" />
            <h2 className="font-editorial mt-3 text-2xl font-semibold">Change password</h2>
            <PasswordChangeForm />
          </CardContent>
        </Card>
        <div className="space-y-5">
          {emailVerificationEnabled ? (
            <Card>
              <CardContent>
                <MailCheck aria-hidden="true" className="text-brand size-5" />
                <h2 className="font-editorial mt-3 text-2xl font-semibold">Email ownership</h2>
                {user.emailVerified === null ? (
                  <>
                    <p className="text-ink-soft mt-2 text-sm leading-6">
                      Confirm your email before accepting an email-addressed household or profile
                      invitation.
                    </p>
                    <form
                      className="mt-4"
                      action="/api/auth/email-verification/request"
                      method="post"
                    >
                      <Button type="submit" variant="secondary">
                        Send confirmation link
                      </Button>
                    </form>
                  </>
                ) : (
                  <p className="text-brand-strong mt-2 text-sm font-semibold">Email confirmed</p>
                )}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardContent>
              <ShieldCheck aria-hidden="true" className="text-sky size-5" />
              <h2 className="font-editorial mt-3 text-2xl font-semibold">Active sessions</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Current browser · created today · expires according to the configured session
                duration.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <RevokeOtherSessionsButton />
                <form method="post" action="/api/auth/sign-out">
                  <Button type="submit" variant="ghost">
                    <LogOut aria-hidden="true" /> Sign out this device
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
          <Alert tone="info" title="Session safety">
            Changing the password increments the account’s session version and invalidates other
            sessions.
          </Alert>
        </div>
      </div>
    </div>
  );
}
