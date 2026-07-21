import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AccountDeletionForm, ProfileDeletionForm } from "@/components/settings/deletion-controls";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listAccessibleProfiles } from "@/server/read-models";

export default async function DataSettingsPage() {
  const { activeProfile: profile } = await listAccessibleProfiles();
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Data rights"
        title="Export and deletion"
        description="Download authorized data or permanently remove a profile or account with explicit confirmation."
      />
      <Alert tone="info" title="Household ownership never bypasses adult privacy">
        A household export contains only profiles the current user is authorized to export. Omitted
        private profiles are counted without exposing medical contents.
      </Alert>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent>
            <Download aria-hidden="true" className="text-brand size-5" />
            <h2 className="font-editorial mt-3 text-2xl font-semibold">Export data</h2>
            <p className="text-ink-soft mt-2 text-sm leading-6">
              Profile ZIPs include JSON, CSVs, source metadata, linked documents, a schema version,
              and a plain-language README.
            </p>
            {profile === null ? (
              <p className="text-ink-soft mt-5 text-sm">
                Create or gain access to a profile before exporting profile data.
              </p>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.capabilities.canExport ? (
                  <Button variant="secondary" asChild>
                    <Link prefetch={false} href={`/api/profiles/${profile.id}/export`}>
                      <Download aria-hidden="true" /> Export {profile.displayName}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-ink-soft text-sm">
                    Your current access to {profile.displayName} is view-only. Profile exports
                    require manage access.
                  </p>
                )}
                {profile.household.members[0]?.role === "owner" ? (
                  <Button variant="secondary" asChild>
                    <Link prefetch={false} href={`/api/households/${profile.householdId}/export`}>
                      <Download aria-hidden="true" /> Export household
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
        {profile?.capabilities.canDelete === true ? (
          <Card className="border-rose/25">
            <CardContent>
              <Trash2 aria-hidden="true" className="text-rose size-5" />
              <h2 className="font-editorial mt-3 text-2xl font-semibold">
                Delete {profile.displayName}
              </h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Care records leave ordinary reads immediately. Private document blobs are removed
                according to the documented deletion policy.
              </p>
              <ProfileDeletionForm profileId={profile.id} profileName={profile.displayName} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Trash2 aria-hidden="true" className="text-ink-soft size-5" />
              <h2 className="font-editorial mt-3 text-2xl font-semibold">Profile deletion</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Only the adult profile owner or the organizer of an unclaimed profile can delete it.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="border-rose/30 bg-rose-soft/45">
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Delete account</h2>
          <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
            Household ownership must be transferred or resolved first. All sessions are invalidated.
            Export is offered before deletion.
          </p>
          <AccountDeletionForm />
        </CardContent>
      </Card>
    </div>
  );
}
