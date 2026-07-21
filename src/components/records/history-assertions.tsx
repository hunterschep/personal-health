"use client";

import { Ban, CircleHelp, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type ReversibleHistoryAssertion = {
  serviceId: string;
  service: string;
  state: "never_completed" | "unsure" | "not_applicable_claim";
  reason: string | null;
  recordedAt: string;
};

const stateContent = {
  never_completed: {
    label: "Never completed",
    detail: "The plan treats this service as not previously completed.",
    icon: Ban,
  },
  unsure: {
    label: "Not sure",
    detail: "The plan keeps this service in an unknown-history state.",
    icon: CircleHelp,
  },
  not_applicable_claim: {
    label: "Your not-applicable response",
    detail: "This organizer preference does not override source-backed eligibility.",
    icon: Ban,
  },
} as const;

export function HistoryAssertions({
  profileId,
  assertions,
  onResetComplete,
}: {
  profileId: string;
  assertions: ReversibleHistoryAssertion[];
  onResetComplete?: (serviceId: string) => void;
}) {
  const [visibleAssertions, setVisibleAssertions] = useState(assertions);
  const [resettingId, setResettingId] = useState<string>();
  const [error, setError] = useState<string>();

  if (visibleAssertions.length === 0) return null;

  async function reset(assertion: ReversibleHistoryAssertion): Promise<void> {
    setResettingId(assertion.serviceId);
    setError(undefined);
    try {
      const query = new URLSearchParams({ serviceId: assertion.serviceId });
      const response = await fetch(`/api/profiles/${profileId}/backfill?${query}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { count?: number; error?: string };
      if (!response.ok || result.count !== 1) {
        setError(result.error ?? "The saved answer could not be reset.");
        return;
      }
      setVisibleAssertions((current) =>
        current.filter((item) => item.serviceId !== assertion.serviceId),
      );
      if (onResetComplete !== undefined) onResetComplete(assertion.serviceId);
      else window.location.reload();
    } catch {
      setError("The saved answer could not be reset.");
    } finally {
      setResettingId(undefined);
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="max-w-2xl">
          <Badge tone="neutral">Saved answers</Badge>
          <h2 className="font-editorial mt-3 text-2xl font-semibold">Answers you can correct</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Resetting an answer does not remove care records. It returns that service to the guided
            queue so you can answer it again.
          </p>
        </div>

        {error !== undefined ? (
          <Alert className="mt-5" tone="error" title="Could not reset answer">
            {error}
          </Alert>
        ) : null}

        <ul className="divide-line mt-5 divide-y">
          {visibleAssertions.map((assertion) => {
            const content = stateContent[assertion.state];
            const Icon = content.icon;
            return (
              <li
                key={assertion.serviceId}
                className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="bg-surface-muted text-ink-soft grid size-10 shrink-0 place-items-center rounded-xl">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{assertion.service}</p>
                    <p className="text-ink-soft mt-1 text-sm">
                      {content.label} · {content.detail}
                    </p>
                    {assertion.reason === null ? null : (
                      <p className="text-ink-soft mt-1 text-xs">Reason: {assertion.reason}</p>
                    )}
                    <p className="text-ink-soft mt-1 text-xs">
                      Saved{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(assertion.recordedAt))}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={resettingId !== undefined}
                  onClick={() => void reset(assertion)}
                  aria-label={`Reset ${assertion.service} answer and ask again`}
                >
                  <RotateCcw aria-hidden="true" />
                  {resettingId === assertion.serviceId ? "Resetting…" : "Reset and ask again"}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
