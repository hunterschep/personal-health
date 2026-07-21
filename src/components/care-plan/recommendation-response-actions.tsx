"use client";

import { BellRing, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type PersonalResponse = "declined" | "not_applicable_claim";

const responseLabels: Record<PersonalResponse, string> = {
  declined: "You chose not to act on this item",
  not_applicable_claim: "You marked this as not applicable to you",
};

export function RecommendationResponseActions({
  profileId,
  serviceId,
  currentResponse,
  currentReason,
  reminder,
  compact = false,
}: {
  profileId: string;
  serviceId: string;
  currentResponse: PersonalResponse | null;
  currentReason?: string | null;
  reminder: { id: string; snoozedUntil: Date | null } | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [draftResponse, setDraftResponse] = useState<PersonalResponse | null>(null);
  const [reason, setReason] = useState("");

  async function setResponse(state: PersonalResponse | null, explanation?: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/profiles/${profileId}/service-history/${serviceId}`, {
        method: state === null ? "DELETE" : "POST",
        ...(state === null
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state, reason: explanation }),
            }),
      });
      if (!response.ok) throw new Error("Personal response could not be saved.");
      setMessage(state === null ? "Personal response cleared." : "Personal response saved.");
      if (state !== null) {
        setDraftResponse(null);
        setReason("");
      }
      router.refresh();
    } catch {
      setMessage("Personal response could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function changeSnooze() {
    if (reminder === null) return;
    setBusy(true);
    setMessage(undefined);
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 7);
    try {
      const response = await fetch(`/api/profiles/${profileId}/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reminder.snoozedUntil === null
            ? { action: "snooze", snoozeUntil: snoozeUntil.toISOString() }
            : { action: "cancel_snooze" },
        ),
      });
      if (!response.ok) throw new Error("Reminder snooze could not be changed.");
      setMessage(
        reminder.snoozedUntil === null
          ? "Reminder snoozed for seven days. The care-plan status is unchanged."
          : "Snooze cancelled. The reminder timing was restored and care-plan status is unchanged.",
      );
      router.refresh();
    } catch {
      setMessage("Reminder snooze could not be changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "border-line bg-surface-muted/45 rounded-xl border p-4",
        compact ? "mt-3" : "mt-5",
      )}
    >
      <p className="font-semibold">{compact ? "Organizer response" : "Your response"}</p>
      <p className="text-ink-soft mt-1 text-sm leading-6">
        These private organizer notes are reversible. They do not diagnose anything or change the
        source-backed recommendation status.
      </p>
      {currentResponse === null ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setDraftResponse("declined")}
            >
              I chose not to do this
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setDraftResponse("not_applicable_claim")}
            >
              This does not apply to me
            </Button>
          </div>
          {draftResponse === null ? null : (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold" htmlFor={`response-${serviceId}`}>
                Brief explanation
              </label>
              <Textarea
                id={`response-${serviceId}`}
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || reason.trim() === ""}
                  onClick={() => void setResponse(draftResponse, reason.trim())}
                >
                  Save response
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDraftResponse(null);
                    setReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">{responseLabels[currentResponse]}.</p>
          {currentReason === null || currentReason === undefined ? null : (
            <p className="text-ink-soft w-full text-xs">Reason: {currentReason}</p>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void setResponse(null)}
          >
            <RotateCcw aria-hidden="true" /> Clear response
          </Button>
        </div>
      )}
      {reminder === null ? null : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 -ml-3"
          disabled={busy}
          onClick={() => void changeSnooze()}
        >
          {reminder.snoozedUntil === null ? (
            <BellRing aria-hidden="true" />
          ) : (
            <RotateCcw aria-hidden="true" />
          )}{" "}
          {reminder.snoozedUntil === null ? "Snooze reminder 7 days" : "Cancel reminder snooze"}
        </Button>
      )}
      {message === undefined ? null : (
        <p className="text-ink-soft mt-3 text-xs" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
