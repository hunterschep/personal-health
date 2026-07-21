"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ProfileAvatar } from "@/components/ui/data-display";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlays";

export type ProfileSwitcherOption = {
  id: string;
  displayName: string;
  relationshipLabel: string;
  householdName: string;
  visibilityLabel: string;
  accessLabel: string;
};

export function profileSwitchDestination(pathname: string, profileId: string): string | null {
  const match = pathname.match(/^\/app\/profile\/[^/]+(?<suffix>\/.*)?$/);
  if (match === null) return null;
  const suffix = match.groups?.suffix ?? "";

  if (/^\/care-plan\/[^/]+(?:\/override)?\/?$/.test(suffix)) {
    return `/app/profile/${profileId}/care-plan`;
  }
  const recordDetail = suffix.match(/^\/records\/(?<segment>[^/]+)\/?$/);
  if (
    recordDetail?.groups?.segment !== undefined &&
    !["new", "backfill", "bulk", "import"].includes(recordDetail.groups.segment)
  ) {
    return `/app/profile/${profileId}/records`;
  }
  return `/app/profile/${profileId}${suffix}`;
}

export function ProfileSwitcher({
  profiles,
  activeProfileId,
  householdName,
}: {
  profiles: ProfileSwitcherOption[];
  activeProfileId: string | null;
  householdName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(activeProfileId ?? "");
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string>();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function selectProfile(profileId: string): Promise<boolean> {
    if (profileId === "") return false;
    if (profileId === activeProfileId) return true;
    const previousId = selectedId;
    setSelectedId(profileId);
    setSwitching(true);
    setError(undefined);
    try {
      const response = await fetch("/api/account/active-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (!response.ok) throw new Error("Profile selection failed");

      const destination = profileSwitchDestination(pathname, profileId);
      if (destination !== null) {
        router.replace(destination);
      } else {
        router.refresh();
      }
      return true;
    } catch {
      setSelectedId(previousId);
      setError("That profile is no longer available.");
      return false;
    } finally {
      setSwitching(false);
    }
  }

  if (profiles.length === 0) {
    return (
      <div className="min-w-0 px-2">
        <span className="text-ink-soft block truncate text-xs">{householdName}</span>
        <span className="block truncate text-sm font-semibold">No profile selected</span>
      </div>
    );
  }

  const activeProfile = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  return (
    <div className="relative min-w-0">
      <label className="hidden min-w-0 sm:block">
        <span className="sr-only">Active profile</span>
        <span className="text-ink-soft pointer-events-none absolute top-1 left-3 max-w-[12rem] truncate text-[0.65rem] sm:max-w-[16rem]">
          {householdName}
        </span>
        <select
          value={selectedId}
          disabled={switching}
          onChange={(event) => void selectProfile(event.target.value)}
          aria-describedby={error === undefined ? undefined : "profile-switcher-error"}
          className="hover:bg-surface-muted focus-visible:ring-brand h-12 max-w-[13rem] appearance-none truncate rounded-xl border border-transparent bg-transparent pt-3 pr-9 pl-3 text-sm font-semibold outline-none focus-visible:ring-2 sm:max-w-[18rem]"
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.displayName} · {profile.relationshipLabel} · {profile.householdName} ·{" "}
              {profile.visibilityLabel} · {profile.accessLabel}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-ink-soft pointer-events-none absolute top-4 right-3 size-4"
        />
      </label>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Choose active profile"
            className="hover:bg-surface-muted flex min-h-12 max-w-[13rem] min-w-0 items-center gap-2 rounded-xl px-2 text-left sm:hidden"
          >
            <ProfileAvatar name={activeProfile?.displayName ?? "Profile"} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="text-ink-soft block truncate text-[0.65rem]">{householdName}</span>
              <span className="block truncate text-sm font-semibold">
                {activeProfile?.displayName ?? "Choose profile"}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className="text-ink-soft size-4 shrink-0" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetTitle className="font-editorial pr-10 text-3xl font-semibold">
            Choose a profile
          </SheetTitle>
          <SheetDescription className="text-ink-soft mt-2 text-sm leading-6">
            Switch the active care plan for {householdName}.
          </SheetDescription>
          <div className="mt-5 grid gap-2">
            {profiles.map((profile) => {
              const active = profile.id === selectedId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  disabled={switching}
                  onClick={() => {
                    void selectProfile(profile.id).then((success) => {
                      if (success) setMobileOpen(false);
                    });
                  }}
                  className="border-line aria-current:border-brand aria-current:bg-brand-soft hover:border-brand/50 flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-50"
                >
                  <ProfileAvatar name={profile.displayName} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{profile.displayName}</span>
                    <span className="text-ink-soft block truncate text-xs">
                      {profile.relationshipLabel} · {profile.visibilityLabel} ·{" "}
                      {profile.accessLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
      {error === undefined ? null : (
        <p
          id="profile-switcher-error"
          role="status"
          className="bg-rose-soft text-rose absolute top-full left-0 z-50 mt-1 w-56 rounded-lg p-2 text-xs shadow-lg"
        >
          {error}
        </p>
      )}
    </div>
  );
}
