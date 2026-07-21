import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { DesktopSidebar, MobileNavigation } from "@/components/shell/navigation";
import { DemoModeBanner } from "@/components/shared/demo-mode-banner";
import { isSyntheticDemoUser } from "@/config/demo";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { listAccessibleProfiles } from "@/server/read-models";

function visibilityLabel(visibility: "owner_only" | "selected_members" | "household"): string {
  if (visibility === "owner_only") return "Owner only";
  if (visibility === "selected_members") return "Selected sharing";
  return "Household shared";
}

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session === null) redirect("/sign-in?reason=session-required");
  const { profiles, activeProfile } = await listAccessibleProfiles();
  const fallbackMembership =
    activeProfile === null
      ? await prisma.householdMember.findFirst({
          where: { userId: session.user.id, removedAt: null, household: { deletedAt: null } },
          include: { household: { select: { name: true } } },
          orderBy: { joinedAt: "asc" },
        })
      : null;
  const householdName =
    activeProfile?.household.name ?? fallbackMembership?.household.name ?? "Your private workspace";
  const demoAccount = isSyntheticDemoUser(session.user.id);
  return (
    <div className="app-shell min-h-screen">
      <DesktopSidebar
        profileId={activeProfile?.id ?? null}
        canEdit={activeProfile?.capabilities.canEdit ?? false}
        canManage={activeProfile?.capabilities.canManage ?? false}
      />
      <AppHeader
        userName={session.user.name ?? "Account owner"}
        householdName={householdName}
        profiles={profiles.map((profile) => ({
          id: profile.id,
          displayName: profile.displayName,
          relationshipLabel: profile.relationshipLabel,
          householdName: profile.household.name,
          visibilityLabel: visibilityLabel(profile.visibility),
          accessLabel: profile.capabilities.canManage
            ? "Can manage"
            : profile.capabilities.canEdit
              ? "Can edit"
              : "View only",
        }))}
        activeProfile={
          activeProfile === null
            ? null
            : {
                id: activeProfile.id,
                visibilityLabel: visibilityLabel(activeProfile.visibility),
                canEdit: activeProfile.capabilities.canEdit,
                canManage: activeProfile.capabilities.canManage,
              }
        }
      />
      <main
        id="main-content"
        className="mx-auto max-w-[96rem] px-4 pt-6 pb-24 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12"
      >
        {demoAccount ? <DemoModeBanner /> : null}
        {children}
      </main>
      <MobileNavigation
        profileId={activeProfile?.id ?? null}
        canEdit={activeProfile?.capabilities.canEdit ?? false}
        canManage={activeProfile?.capabilities.canManage ?? false}
      />
    </div>
  );
}
