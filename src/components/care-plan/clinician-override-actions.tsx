"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ClinicianOverrideActions({
  profileId,
  recommendationId,
  overrideId,
  paused,
}: {
  profileId: string;
  recommendationId: string;
  overrideId: string;
  paused: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function endInstruction(): Promise<void> {
    if (
      !window.confirm(
        "End this clinician instruction? The general guideline will become the active context after the care plan recalculates.",
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    const response = await fetch(
      `/api/profiles/${profileId}/clinician-overrides/${overrideId}?recommendationId=${encodeURIComponent(recommendationId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "The clinician instruction could not be ended.");
      setBusy(false);
      return;
    }
    const result = (await response.json()) as { activeRecommendationId?: string };
    window.location.replace(
      result.activeRecommendationId === undefined
        ? `/app/profile/${profileId}/care-plan`
        : `/app/profile/${profileId}/care-plan/${result.activeRecommendationId}`,
    );
  }

  async function setPaused(action: "pause" | "resume"): Promise<void> {
    setBusy(true);
    setError(undefined);
    const response = await fetch(`/api/profiles/${profileId}/clinician-overrides/${overrideId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "The clinician instruction could not be updated.");
      setBusy(false);
      return;
    }
    const result = (await response.json()) as { activeRecommendationId?: string };
    window.location.replace(
      result.activeRecommendationId === undefined
        ? `/app/profile/${profileId}/care-plan`
        : `/app/profile/${profileId}/care-plan/${result.activeRecommendationId}`,
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void setPaused(paused ? "resume" : "pause")}
      >
        {busy ? "Updating…" : paused ? "Resume instruction" : "Pause instruction"}
      </Button>
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link
          href={`/app/profile/${profileId}/care-plan/${recommendationId}/override?edit=${encodeURIComponent(overrideId)}`}
        >
          Edit as new version
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => void endInstruction()}
      >
        {busy ? "Ending…" : "End instruction"}
      </Button>
      {error !== undefined ? (
        <p className="text-rose basis-full text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
