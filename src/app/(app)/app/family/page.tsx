import {
  ArrowRight,
  Clock3,
  LockKeyhole,
  Plus,
  Send,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { ProfileQuickActions } from "@/components/family/profile-quick-actions";
import { PageHeader } from "@/components/shared/page-header";
import { PrivacyIndicator } from "@/components/shared/privacy-indicator";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/server/db/client";
import { familyActivityLabel } from "@/server/read-models/family-activity";
import { listAccessibleProfiles, profileSummary } from "@/server/read-models";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ profileDeleted?: string; cleanupPending?: string }>;
}) {
  const flags = await searchParams;
  const { session, profiles: accessible, activeProfile } = await listAccessibleProfiles();
  const selectedMembership =
    activeProfile === null
      ? null
      : await prisma.householdMember.findFirst({
          where: {
            householdId: activeProfile.householdId,
            userId: session.user.id,
            removedAt: null,
            household: { deletedAt: null },
          },
          include: { household: true },
        });
  const membership =
    selectedMembership ??
    (await prisma.householdMember.findFirst({
      where: { userId: session.user.id, removedAt: null, household: { deletedAt: null } },
      include: { household: true },
      orderBy: { joinedAt: "asc" },
    }));
  if (membership === null) {
    return (
      <div className="space-y-7">
        <PageHeader
          eyebrow="Privacy-aware coordination"
          title="Your household"
          description="Create an adult profile to begin a private household workspace."
        />
        <EmptyState
          icon={UsersRound}
          title="No household yet"
          description="The onboarding flow creates a household and the first owner-controlled adult profile together."
        />
        <Button asChild>
          <Link href="/app/onboarding">
            <Plus aria-hidden="true" /> Create the first profile
          </Link>
        </Button>
      </div>
    );
  }
  const profiles = accessible.filter(({ householdId }) => householdId === membership.householdId);
  const canManage = membership.role === "owner" || membership.role === "admin";
  const [pendingInvites, pendingClaims, activityPreferences, activity] = await Promise.all([
    canManage
      ? prisma.householdInvite.count({
          where: {
            householdId: membership.householdId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      : Promise.resolve(0),
    canManage
      ? prisma.profileClaimInvite.findMany({
          where: {
            profile: { householdId: membership.householdId, deletedAt: null },
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { profileId: true },
        })
      : Promise.resolve([]),
    prisma.reminderPreference.findMany({
      where: {
        profileId: { in: profiles.map(({ id }) => id) },
        householdActivityDetail: true,
      },
      select: { profileId: true, userId: true },
    }),
    prisma.auditLog.findMany({
      where: {
        householdId: membership.householdId,
        OR: [{ profileId: null }, { profileId: { in: profiles.map(({ id }) => id) } }],
        action: {
          in: [
            "care_event.created",
            "care_event.updated",
            "care_plan.changed",
            "guideline_rule.updated",
            "profile.created",
            "profile.sharing_updated",
            "household.invite_accepted",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const pendingClaimProfileIds = new Set(pendingClaims.map(({ profileId }) => profileId));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const detailedProfileIds = new Set(
    activityPreferences.flatMap((preference) => {
      const profile = profilesById.get(preference.profileId);
      return profile !== undefined &&
        profile.visibility !== "owner_only" &&
        preference.userId === profile.ownerUserId
        ? [profile.id]
        : [];
    }),
  );
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Privacy-aware coordination"
        title={membership.household.name}
        description="Only profiles this account may view are included. Adult privacy is independent of household role."
        actions={
          <>
            {canManage ? (
              <Button variant="secondary" asChild>
                <Link href="/app/family/invites">
                  <Send aria-hidden="true" /> Invite member
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/app/onboarding">
                <Plus aria-hidden="true" /> Add adult profile
              </Link>
            </Button>
          </>
        }
      />
      {flags.profileDeleted === "1" ? (
        <Alert tone="success" title="Profile deleted">
          The profile is no longer available.
          {flags.cleanupPending === "1"
            ? " A private document cleanup retry remains queued for the self-hosted operator."
            : " Linked private document deletion completed."}
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Household summary">
        <Card>
          <CardContent>
            <UsersRound aria-hidden="true" className="text-brand size-5" />
            <p className="font-editorial mt-3 text-3xl font-semibold">{profiles.length}</p>
            <p className="text-sm font-semibold">Visible profiles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <UserRoundCheck aria-hidden="true" className="text-brand size-5" />
            <p className="font-editorial mt-3 text-3xl font-semibold">
              {canManage ? pendingClaims.length : "—"}
            </p>
            <p className="text-sm font-semibold">
              {canManage ? "Pending profile claims" : "Claims managed privately"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Send aria-hidden="true" className="text-sky size-5" />
            <p className="font-editorial mt-3 text-3xl font-semibold">
              {canManage ? pendingInvites : "—"}
            </p>
            <p className="text-sm font-semibold">
              {canManage ? "Pending invitations" : "Invites managed privately"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Clock3 aria-hidden="true" className="text-accent size-5" />
            <p className="font-editorial mt-3 text-2xl font-semibold break-words">
              {membership.household.timezone}
            </p>
            <p className="text-sm font-semibold">Household timezone</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="profiles-heading">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="profiles-heading" className="font-editorial text-3xl font-semibold">
            Profiles you can view
          </h2>
          <p className="text-ink-soft text-sm">{profiles.length} visible</p>
        </div>
        {profiles.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No visible profiles"
            description="An adult may keep a claimed profile owner-only. Create a profile you own or ask its owner to share it explicitly."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {profiles.map((profile) => {
              const summary = profileSummary(profile);
              return (
                <Card key={profile.id} className="overflow-hidden">
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <span className="bg-brand-soft text-brand-strong grid size-12 place-items-center rounded-full font-semibold">
                        {initials(profile.displayName)}
                      </span>
                      <PrivacyIndicator
                        label={
                          profile.visibility === "owner_only"
                            ? "Owner only"
                            : profile.visibility === "selected_members"
                              ? "Selected sharing"
                              : "Household shared"
                        }
                      />
                    </div>
                    <h3 className="font-editorial mt-4 text-2xl font-semibold">
                      {profile.displayName}
                    </h3>
                    <p className="text-ink-soft mt-1 text-sm">
                      {profile.relationshipLabel} · age {summary.age}
                    </p>
                    <p className="text-ink-soft mt-2 text-xs">
                      {profile.claimedAt !== null
                        ? "Owned profile"
                        : pendingClaimProfileIds.has(profile.id)
                          ? "Ownership invitation pending"
                          : "Unclaimed profile"}
                      {" · Updated "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeZone: membership.household.timezone,
                      }).format(profile.updatedAt)}
                    </p>
                    <dl className="bg-surface-muted/60 mt-5 grid grid-cols-3 gap-2 rounded-xl p-3 text-center">
                      <div>
                        <dt className="text-ink-soft text-[0.62rem] font-bold tracking-wider uppercase">
                          Attention
                        </dt>
                        <dd className="font-editorial mt-1 text-xl font-semibold">
                          {summary.attention}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft text-[0.62rem] font-bold tracking-wider uppercase">
                          This year
                        </dt>
                        <dd className="font-editorial mt-1 text-xl font-semibold">
                          {summary.thisYear}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft text-[0.62rem] font-bold tracking-wider uppercase">
                          Unknown
                        </dt>
                        <dd className="font-editorial mt-1 text-xl font-semibold">
                          {summary.unknown}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <p className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                        Next action
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {summary.next?.service.name ?? "Add history to build this plan"}
                      </p>
                    </div>
                    <form method="post" action="/api/account/active-profile">
                      <input type="hidden" name="profileId" value={profile.id} />
                      <Button type="submit" variant="secondary" className="mt-5 w-full">
                        Open profile <ArrowRight aria-hidden="true" />
                      </Button>
                    </form>
                    <ProfileQuickActions
                      profileId={profile.id}
                      displayName={profile.displayName}
                      canEdit={profile.capabilities.canEdit}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">Privacy-aware activity</h2>
            <div className="border-line mt-5 divide-y">
              {activity.length === 0 ? (
                <p className="text-ink-soft text-sm">No shared household activity yet.</p>
              ) : (
                activity.map((event) => (
                  <div key={event.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="bg-surface-muted text-ink-soft grid size-8 shrink-0 place-items-center rounded-full">
                      {event.action === "household.invite_accepted" ? (
                        <UserRoundCheck aria-hidden="true" className="size-4" />
                      ) : (
                        <Clock3 aria-hidden="true" className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {familyActivityLabel({
                          action: event.action,
                          profile:
                            event.profileId === null
                              ? null
                              : (profilesById.get(event.profileId) ?? null),
                          detailEnabled:
                            event.profileId !== null && detailedProfileIds.has(event.profileId),
                        })}
                      </p>
                      <p className="text-ink-soft mt-1 text-xs">
                        Redacted household event ·{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeZone: membership.household.timezone,
                        }).format(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-brand/25 bg-brand-soft/60">
          <CardContent>
            <LockKeyhole aria-hidden="true" className="text-brand size-5" />
            <h2 className="font-editorial mt-3 text-xl font-semibold">Private means absent</h2>
            <p className="text-ink-soft mt-2 text-sm leading-6">
              Owner-only adult profiles and their health counts never enter this dashboard payload.
              Household administration does not reveal them.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
