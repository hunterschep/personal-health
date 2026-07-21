import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CirclePlus,
  History,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import type { RecommendationStatus } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RecommendationResponseActions } from "./recommendation-response-actions";

export type RecommendationCardData = {
  id: string;
  serviceId?: string;
  serviceSlug?: string;
  service: string;
  category: string;
  status: RecommendationStatus;
  timing: string;
  reason: string;
  history: string;
  source: string;
  recommendationClass?: string;
  planned?: boolean;
  clinicianOverride?: boolean;
  personalResponse?: "declined" | "not_applicable_claim" | null;
  personalResponseReason?: string | null;
  reminder?: { id: string; snoozedUntil: Date | null } | null;
};

export function RecommendationCard({
  profileId,
  recommendation,
  editable = true,
}: {
  profileId: string;
  recommendation: RecommendationCardData;
  editable?: boolean;
}) {
  return (
    <Card className="hover:border-line-strong overflow-hidden transition">
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ink-soft text-[0.68rem] font-bold tracking-[0.08em] uppercase">
              {recommendation.category}
            </p>
            {recommendation.planned ? <Badge tone="brand">Planned</Badge> : null}
            {recommendation.clinicianOverride ? <Badge tone="cool">Personal plan</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="font-editorial text-2xl font-semibold tracking-[-0.025em]">
              {recommendation.service}
            </h3>
            <StatusBadge status={recommendation.status} />
          </div>
          <p className="text-ink-soft mt-3 text-sm leading-6">{recommendation.reason}</p>
          <div className="text-ink-soft mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden="true" className="size-3.5" /> {recommendation.timing}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <History aria-hidden="true" className="size-3.5" /> {recommendation.history}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Stethoscope aria-hidden="true" className="size-3.5" /> {recommendation.source}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-56 lg:justify-end">
          {editable ? (
            <>
              <Button variant="quiet" size="sm" asChild>
                <Link
                  href={`/app/profile/${profileId}/records/new?service=${recommendation.serviceSlug ?? recommendation.id}`}
                >
                  <CirclePlus aria-hidden="true" /> Add record
                </Link>
              </Button>
              <Button variant="quiet" size="sm" asChild>
                <Link
                  href={`/app/profile/${profileId}/records/new?service=${recommendation.serviceSlug ?? recommendation.id}&intent=complete`}
                >
                  <CheckCircle2 aria-hidden="true" /> Mark completed
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/app/profile/${profileId}/calendar?plan=${recommendation.id}`}>
                  <CalendarPlus aria-hidden="true" /> Plan
                </Link>
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/profile/${profileId}/care-plan/${recommendation.id}`}>
              Details <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        {editable && recommendation.serviceId !== undefined ? (
          <details className="border-line bg-surface-muted/35 rounded-xl border p-3 lg:col-span-2">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal aria-hidden="true" className="size-4" /> More actions
            </summary>
            <div className="mt-3">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/app/profile/${profileId}/care-plan/${recommendation.id}/override`}>
                  <Stethoscope aria-hidden="true" /> Add clinician instruction
                </Link>
              </Button>
              <RecommendationResponseActions
                profileId={profileId}
                serviceId={recommendation.serviceId}
                currentResponse={recommendation.personalResponse ?? null}
                currentReason={recommendation.personalResponseReason ?? null}
                reminder={recommendation.reminder ?? null}
                compact
              />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
