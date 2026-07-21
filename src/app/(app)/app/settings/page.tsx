import { Bell, Database, KeyRound, Palette, Share2, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { ReminderPreferences } from "@/components/settings/reminder-preferences";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listAccessibleProfiles } from "@/server/read-models";

export default async function SettingsPage() {
  const { activeProfile } = await listAccessibleProfiles();
  const activeMembership = activeProfile?.household.members[0] ?? null;
  const canManageHousehold =
    activeMembership?.role === "owner" || activeMembership?.role === "admin";
  const settingsLinks = [
    [KeyRound, "Security", "Password, sessions, and account access", "/app/settings/security"],
    [
      Database,
      "Data and privacy",
      "Exports, profile deletion, and account deletion",
      "/app/settings/data",
    ],
    [
      UsersRound,
      "Household",
      canManageHousehold
        ? "Name, timezone, members, roles, and ownership"
        : "View profiles shared in this household",
      canManageHousehold ? "/app/family/manage" : "/app/family",
    ],
    ...(activeProfile?.capabilities.canEdit === true
      ? [
          [
            UserRound,
            `${activeProfile.displayName}'s profile`,
            "Basics, anatomy, timezone, and care-plan mode",
            `/app/profile/${activeProfile.id}/settings`,
          ] as const,
        ]
      : []),
    ...(activeProfile?.capabilities.canManage === true
      ? [
          [
            Share2,
            "Profile sharing",
            `Control access to ${activeProfile.displayName}'s profile`,
            `/app/profile/${activeProfile.id}/sharing`,
          ] as const,
        ]
      : []),
    [Palette, "Appearance", "Light, dark, or system appearance", "#appearance"],
  ] as const;
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account and household"
        title="Settings"
        description="Control reminder behavior, security, appearance, sharing, exports, and deletion."
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Settings sections">
        {settingsLinks.map(([Icon, title, description, href]) => (
          <Link key={title} href={href}>
            <Card className="hover:border-brand/40 h-full transition hover:-translate-y-0.5">
              <CardContent>
                <Icon aria-hidden="true" className="text-brand size-5" />
                <h2 className="font-editorial mt-3 text-xl font-semibold">{title}</h2>
                <p className="text-ink-soft mt-2 text-sm leading-6">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
      <section id="appearance" aria-labelledby="appearance-heading">
        <div className="mb-4 flex items-center gap-2">
          <Palette aria-hidden="true" className="text-brand size-5" />
          <h2 id="appearance-heading" className="font-editorial text-3xl font-semibold">
            Appearance
          </h2>
        </div>
        <AppearanceSettings />
      </section>
      <section aria-labelledby="reminders-heading">
        <div className="mb-4 flex items-center gap-2">
          <Bell aria-hidden="true" className="text-brand size-5" />
          <h2 id="reminders-heading" className="font-editorial text-3xl font-semibold">
            Reminders
          </h2>
        </div>
        <ReminderPreferences />
      </section>
    </div>
  );
}
