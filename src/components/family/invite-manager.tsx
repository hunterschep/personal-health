"use client";

import { Check, Clock3, Copy, Send, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Input, Select } from "@/components/ui/form";

type PendingInvite = { id: string; email: string; role: string; expiresAt: string };
type ClaimableProfile = { id: string; name: string };
type PendingClaimInvite = {
  id: string;
  profileId: string;
  profileName: string;
  email: string;
  expiresAt: string;
};

export function InviteManager({
  householdId,
  initialInvites,
  claimableProfiles,
  initialClaimInvites,
}: {
  householdId: string;
  initialInvites: PendingInvite[];
  claimableProfiles: ClaimableProfile[];
  initialClaimInvites: PendingClaimInvite[];
}) {
  const [invites, setInvites] = useState(initialInvites);
  const [claimInvites, setClaimInvites] = useState(initialClaimInvites);
  const [link, setLink] = useState<string>();
  const [linkInviteId, setLinkInviteId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [copied, setCopied] = useState(false);

  async function createHouseholdInvite(formData: FormData) {
    setError(undefined);
    setNotice(undefined);
    const response = await fetch(`/api/households/${householdId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const payload = (await response.json()) as {
      error?: string;
      inviteId?: string;
      acceptPath?: string;
      expiresAt?: string;
    };
    if (
      !response.ok ||
      payload.inviteId === undefined ||
      payload.acceptPath === undefined ||
      payload.expiresAt === undefined
    ) {
      setError(payload.error ?? "The invitation could not be created.");
      return;
    }
    const { inviteId, acceptPath, expiresAt } = payload;
    const email = String(formData.get("email"));
    const role = String(formData.get("role"));
    setInvites((items) => [
      {
        id: inviteId,
        email,
        role,
        expiresAt,
      },
      ...items,
    ]);
    setLink(`${window.location.origin}${acceptPath}`);
    setLinkInviteId(inviteId);
    setCopied(false);
    setNotice("Household invitation created. Copy the one-time link before leaving this page.");
  }

  async function createClaimInvite(formData: FormData) {
    setError(undefined);
    setNotice(undefined);
    const profileId = String(formData.get("profileId"));
    const response = await fetch(`/api/profiles/${profileId}/claim-invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const payload = (await response.json()) as {
      error?: string;
      inviteId?: string;
      acceptPath?: string;
      expiresAt?: string;
    };
    if (
      !response.ok ||
      payload.inviteId === undefined ||
      payload.acceptPath === undefined ||
      payload.expiresAt === undefined
    ) {
      setError(payload.error ?? "The claim invitation could not be created.");
      return;
    }
    const { inviteId, acceptPath, expiresAt } = payload;
    const profile = claimableProfiles.find(({ id }) => id === profileId);
    setClaimInvites((items) => [
      {
        id: inviteId,
        profileId,
        profileName: profile?.name ?? "Unclaimed profile",
        email: String(formData.get("email")),
        expiresAt,
      },
      ...items.filter((item) => item.profileId !== profileId),
    ]);
    setLink(`${window.location.origin}${acceptPath}`);
    setLinkInviteId(inviteId);
    setCopied(false);
    setNotice("Profile claim invitation created. Copy the one-time link before leaving this page.");
  }

  async function revoke(inviteId: string) {
    setError(undefined);
    setNotice(undefined);
    const response = await fetch(`/api/households/${householdId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setInvites((items) => items.filter(({ id }) => id !== inviteId));
      if (linkInviteId === inviteId) {
        setLink(undefined);
        setLinkInviteId(undefined);
        setCopied(false);
      }
      setNotice("Household invitation revoked.");
    } else {
      setError("The household invitation could not be revoked.");
    }
  }

  async function revokeClaimInvite(invite: PendingClaimInvite) {
    setError(undefined);
    setNotice(undefined);
    const response = await fetch(`/api/profiles/${invite.profileId}/claim-invites/${invite.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setClaimInvites((items) => items.filter(({ id }) => id !== invite.id));
      if (linkInviteId === invite.id) {
        setLink(undefined);
        setLinkInviteId(undefined);
        setCopied(false);
      }
      setNotice("Profile claim invitation revoked.");
    } else {
      setError("The profile claim invitation could not be revoked.");
    }
  }

  async function copyLink() {
    if (link === undefined) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="space-y-5">
      {error !== undefined ? (
        <Alert tone="error" title="Invitation action failed">
          {error}
        </Alert>
      ) : null}
      {notice !== undefined ? (
        <Alert tone="success" title="Invitation updated">
          {notice}
        </Alert>
      ) : null}
      {link !== undefined ? (
        <Alert tone="success" title="One-time invitation link created">
          <p className="text-sm break-all">{link}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void copyLink()}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{" "}
            {copied ? "Copied" : "Copy secure link"}
          </Button>
          <p className="mt-3 text-xs">
            Send this link through a trusted channel. The raw token is shown only now and is not
            stored.
          </p>
        </Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">Invite a household member</h2>
            <p className="text-ink-soft mt-2 text-sm">
              Membership alone never reveals owner-only adult profiles.
            </p>
            <form action={createHouseholdInvite} className="mt-5 space-y-4">
              <FormField id="inviteEmail" label="Email">
                <Input id="inviteEmail" name="email" type="email" required />
              </FormField>
              <FormField id="role" label="Household role">
                <Select id="role" name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormField>
              <Button type="submit">
                <Send aria-hidden="true" /> Create invitation
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">
              Invite an adult to claim a profile
            </h2>
            <Alert tone="info" title="Ownership changes immediately">
              Accepting makes the recipient the profile owner and changes the profile to owner-only.
              The creator keeps access only if the new owner shares it.
            </Alert>
            {claimableProfiles.length === 0 ? (
              <p className="text-ink-soft mt-5 text-sm">
                There are no unclaimed adult profiles in this household.
              </p>
            ) : (
              <form action={createClaimInvite} className="mt-5 space-y-4">
                <FormField id="profile" label="Unclaimed profile">
                  <Select id="profile" name="profileId">
                    {claimableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="claimEmail" label="Recipient email">
                  <Input id="claimEmail" name="email" type="email" required />
                </FormField>
                <Button type="submit">
                  <UserRoundCheck aria-hidden="true" /> Create claim invitation
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-2xl font-semibold">Pending household invitations</h2>
            <Badge tone="warm">{invites.length} pending</Badge>
          </div>
          {invites.length === 0 ? (
            <p className="text-ink-soft mt-5 text-sm">No active invitations.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="border-line flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex gap-3">
                    <Clock3 aria-hidden="true" className="text-accent mt-1 size-4" />
                    <div>
                      <p className="font-semibold">{invite.email}</p>
                      <p className="text-ink-soft mt-1 text-sm capitalize">
                        {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void revoke(invite.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-2xl font-semibold">
              Pending profile claim invitations
            </h2>
            <Badge tone="warm">{claimInvites.length} pending</Badge>
          </div>
          {claimInvites.length === 0 ? (
            <p className="text-ink-soft mt-5 text-sm">No active profile claim invitations.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {claimInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="border-line flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex gap-3">
                    <UserRoundCheck aria-hidden="true" className="text-accent mt-1 size-4" />
                    <div>
                      <p className="font-semibold">{invite.profileName}</p>
                      <p className="text-ink-soft mt-1 text-sm">
                        {invite.email} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void revokeClaimInvite(invite)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
