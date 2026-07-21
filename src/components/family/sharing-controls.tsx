"use client";

import { Check, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/form";

const visibilityOptions = [
  {
    value: "owner_only",
    label: "Only me",
    description: "No other household member can open this profile.",
    icon: LockKeyhole,
  },
  {
    value: "selected_members",
    label: "Selected members",
    description: "Choose each person and their permission.",
    icon: ShieldCheck,
  },
  {
    value: "household",
    label: "Whole household",
    description: "Active household members can view, but not automatically edit.",
    icon: UsersRound,
  },
] as const;

type SharingMember = {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  permission: "view" | "edit" | "manage";
};

export function SharingControls({
  profileId,
  initialVisibility,
  initialMembers,
}: {
  profileId: string;
  initialVisibility: "owner_only" | "selected_members" | "household";
  initialMembers: SharingMember[];
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [saved, setSaved] = useState(initialVisibility);
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string>();

  async function save() {
    setError(undefined);
    const response = await fetch(`/api/profiles/${profileId}/sharing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visibility,
        grants:
          visibility === "selected_members"
            ? members
                .filter(({ enabled }) => enabled)
                .map(({ id, permission }) => ({ userId: id, permission }))
            : [],
      }),
    });
    if (response.ok) setSaved(visibility);
    else {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Sharing settings could not be saved.");
    }
  }

  return (
    <div className="space-y-5">
      <Alert tone="info" title="Adult ownership comes first">
        Household owner or admin status does not bypass an owner-only claimed adult profile. Changes
        take effect immediately.
      </Alert>
      <div className="grid gap-3 lg:grid-cols-3">
        {visibilityOptions.map(({ value, label, description, icon: Icon }) => {
          const selected = visibility === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setVisibility(value)}
              className={`rounded-card border p-5 text-left transition ${selected ? "border-brand bg-brand-soft ring-brand/15 ring-2" : "border-line bg-surface hover:border-line-strong"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="bg-surface-raised text-brand grid size-10 place-items-center rounded-xl">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {saved === value ? (
                  <span
                    className="bg-brand grid size-7 place-items-center rounded-full text-white"
                    aria-label="Current setting"
                  >
                    <Check aria-hidden="true" className="size-4" />
                  </span>
                ) : null}
              </div>
              <h2 className="font-editorial mt-4 text-xl font-semibold">{label}</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">{description}</p>
            </button>
          );
        })}
      </div>

      {visibility === "selected_members" ? (
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">Selected access</h2>
            <div className="mt-5 space-y-3">
              {members.length === 0 ? (
                <p className="text-ink-soft text-sm">
                  Invite another household member before selecting individual access.
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="border-line flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
                  >
                    <label className="flex flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={member.enabled}
                        onChange={(event) =>
                          setMembers((items) =>
                            items.map((item) =>
                              item.id === member.id
                                ? { ...item, enabled: event.target.checked }
                                : item,
                            ),
                          )
                        }
                        className="accent-brand size-4"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{member.name}</span>
                        <span className="text-ink-soft block text-xs">{member.email}</span>
                      </span>
                    </label>
                    <Select
                      aria-label={`${member.name} permission`}
                      disabled={!member.enabled}
                      value={member.permission}
                      onChange={(event) =>
                        setMembers((items) =>
                          items.map((item) =>
                            item.id === member.id
                              ? {
                                  ...item,
                                  permission: event.target.value as SharingMember["permission"],
                                }
                              : item,
                          ),
                        )
                      }
                      className="sm:w-40"
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                      <option value="manage">Can manage</option>
                    </Select>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saved === visibility && visibility !== "selected_members"}
        >
          Save sharing settings
        </Button>
      </div>
      {error !== undefined ? (
        <p className="text-rose text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
