import { InviteAuthActions, InviteSwitchAccount } from "@/components/family/invite-auth-actions";
import { Brand } from "@/components/shared/brand";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/server/auth/session";
import { loadHouseholdInvitePreview } from "@/server/invitations";

export default async function HouseholdInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const returnTo = `/invite/household/${token}`;
  const session = await getSession();
  const preview =
    session === null ? null : await loadHouseholdInvitePreview(token, session.user.email);

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-5 py-12">
      <div className="w-full space-y-6">
        <Brand />
        <Card>
          <CardContent>
            <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
              Household invitation
            </p>
            <h1 className="font-editorial mt-3 text-3xl font-semibold">
              Join a CareCadence household
            </h1>
            <p className="text-ink-soft mt-3 leading-7">
              Household membership does not automatically reveal owner-only adult profiles. Each
              adult controls their own sharing.
            </p>
            <div className="mt-6">
              {session === null ? (
                <Alert tone="info" title="Sign in with the invited email">
                  <p className="mb-4">
                    Your invitation will remain available through sign-in or account creation.
                  </p>
                  <InviteAuthActions returnTo={returnTo} />
                </Alert>
              ) : preview === null ? (
                <Alert tone="warning" title="Invitation unavailable for this account">
                  <p className="mb-4">
                    Signed in as {session.user.email}. Use the email address that received the
                    invitation.
                  </p>
                  <InviteSwitchAccount returnTo={returnTo} />
                </Alert>
              ) : (
                <>
                  <dl className="bg-surface-muted grid gap-3 rounded-xl p-4 text-sm">
                    <div>
                      <dt className="text-ink-soft font-semibold">Household</dt>
                      <dd>{preview.householdName}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-soft font-semibold">Invited by</dt>
                      <dd>{preview.inviterName}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-soft font-semibold">Household role</dt>
                      <dd className="capitalize">{preview.role}</dd>
                    </div>
                  </dl>
                  <form action="/api/invitations/household/accept" method="post" className="mt-5">
                    <input type="hidden" name="token" value={token} />
                    <p className="text-ink-soft mb-4 text-sm">Signed in as {session.user.email}</p>
                    <Button type="submit">Accept household invitation</Button>
                  </form>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
