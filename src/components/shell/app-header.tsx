import { Settings2, Share2 } from "lucide-react";
import Link from "next/link";
import { PrivacyIndicator } from "@/components/shared/privacy-indicator";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { ProfileSwitcher, type ProfileSwitcherOption } from "@/components/shell/profile-switcher";
import { UserMenu } from "@/components/shell/user-menu";

type HeaderProfile = {
  id: string;
  visibilityLabel: string;
  canEdit: boolean;
  canManage: boolean;
};

export function AppHeader({
  userName,
  householdName,
  profiles,
  activeProfile,
}: {
  userName: string;
  householdName: string;
  profiles: ProfileSwitcherOption[];
  activeProfile: HeaderProfile | null;
}) {
  const userInitials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <header className="border-line bg-background/80 sticky top-0 z-20 border-b backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[96rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            href="/app/family"
            aria-label={`${userName}'s household`}
            className="hover:bg-surface-muted grid size-11 shrink-0 place-items-center rounded-xl"
          >
            <span className="bg-brand-soft text-brand-strong grid size-9 place-items-center rounded-full text-sm font-bold">
              {userInitials}
            </span>
          </Link>
          <ProfileSwitcher
            key={activeProfile?.id ?? "no-active-profile"}
            profiles={profiles}
            activeProfileId={activeProfile?.id ?? null}
            householdName={householdName}
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {activeProfile === null ? null : (
            <span className="hidden xl:inline-flex">
              <PrivacyIndicator label={activeProfile.visibilityLabel} />
            </span>
          )}
          {activeProfile?.canManage === true ? (
            <Button variant="ghost" size="icon" aria-label="Manage active profile sharing" asChild>
              <Link href={`/app/profile/${activeProfile.id}/sharing`}>
                <Share2 aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {activeProfile?.canEdit === true ? (
            <Button variant="ghost" size="icon" aria-label="Edit active profile" asChild>
              <Link href={`/app/profile/${activeProfile.id}/settings`}>
                <Settings2 aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <ThemeToggle />
          <UserMenu userName={userName} />
        </div>
      </div>
    </header>
  );
}
