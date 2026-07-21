"use client";

import { LogOut, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Input, Select } from "@/components/ui/form";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  isCurrent: boolean;
};

export function HouseholdManager({
  householdId,
  initialName,
  initialTimezone,
  currentRole,
  initialMembers,
}: {
  householdId: string;
  initialName: string;
  initialTimezone: string;
  currentRole: "owner" | "admin" | "member";
  initialMembers: Member[];
}) {
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [members, setMembers] = useState(initialMembers);
  const [message, setMessage] = useState<string>();
  const canManage = currentRole !== "member";
  const isOwner = currentRole === "owner";
  async function updateHousehold() {
    const response = await fetch(`/api/households/${householdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone }),
    });
    const payload = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Household settings saved."
        : (payload.error ?? "The household could not be updated."),
    );
  }
  async function updateRole(member: Member, role: "admin" | "member") {
    const response = await fetch(`/api/households/${householdId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (response.ok)
      setMembers((items) =>
        items.map((item) => (item.id === member.id ? { ...item, role } : item)),
      );
  }
  async function remove(member: Member) {
    if (!window.confirm(`Remove ${member.name} from the household?`)) return;
    const response = await fetch(`/api/households/${householdId}/members/${member.id}`, {
      method: "DELETE",
    });
    if (response.ok) setMembers((items) => items.filter(({ id }) => id !== member.id));
  }
  async function transfer(member: Member) {
    if (!window.confirm(`Transfer household ownership to ${member.name}?`)) return;
    const response = await fetch(`/api/households/${householdId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.userId }),
    });
    if (response.ok) window.location.reload();
  }
  async function leave() {
    if (!window.confirm("Leave this household? Explicit profile access grants will be removed."))
      return;
    const response = await fetch(`/api/households/${householdId}/leave`, { method: "POST" });
    if (response.ok) window.location.assign("/app");
  }
  return (
    <div className="space-y-5">
      {message !== undefined ? (
        <Alert tone={message.includes("saved") ? "success" : "error"} title="Household settings">
          {message}
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Household details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <FormField id="household-name" label="Name">
              <Input
                id="household-name"
                value={name}
                disabled={!canManage}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id="household-timezone" label="Timezone">
              <Input
                id="household-timezone"
                value={timezone}
                disabled={!canManage}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </FormField>
            {canManage ? (
              <Button type="button" onClick={() => void updateHousehold()}>
                <Save aria-hidden="true" /> Save
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Members</h2>
          <div className="mt-5 space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="border-line flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{member.name}</p>
                    {member.isCurrent ? <Badge>You</Badge> : null}
                    {member.role === "owner" ? (
                      <Badge tone="brand">
                        <ShieldCheck aria-hidden="true" /> Owner
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-ink-soft mt-1 text-sm">{member.email}</p>
                </div>
                {isOwner && member.role !== "owner" ? (
                  <>
                    <Select
                      aria-label={`${member.name} role`}
                      value={member.role}
                      onChange={(event) =>
                        void updateRole(member, event.target.value as "admin" | "member")
                      }
                      className="lg:w-36"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void transfer(member)}
                    >
                      Make owner
                    </Button>
                  </>
                ) : (
                  <Badge>{member.role}</Badge>
                )}
                {canManage && !member.isCurrent && member.role !== "owner" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => void remove(member)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {currentRole !== "owner" ? (
        <div className="flex justify-end">
          <Button type="button" variant="destructive" onClick={() => void leave()}>
            <LogOut aria-hidden="true" /> Leave household
          </Button>
        </div>
      ) : (
        <Alert tone="info" title="Owner safeguard">
          Transfer ownership to another active member before leaving. A household always has exactly
          one owner.
        </Alert>
      )}
    </div>
  );
}
