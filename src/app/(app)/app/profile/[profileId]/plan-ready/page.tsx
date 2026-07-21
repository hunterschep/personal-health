import { ArrowRight, ClipboardCheck, HeartPulse, Sparkles, Stethoscope } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

export default async function PlanReadyPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const [recommendationCount, historyNeeded] = await Promise.all([
    prisma.recommendationInstance.count({ where: { profileId: profile.id, retiredAt: null } }),
    prisma.recommendationInstance.count({
      where: { profileId: profile.id, retiredAt: null, status: "unknown_history" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Initial plan ready"
        title={`${profile.displayName}'s care plan has a starting point`}
        description="The plan uses reviewed guidance and the context you entered. Missing history remains visible instead of being guessed."
        actions={
          <Button asChild>
            <Link href={`/app/profile/${profile.id}/care-plan`}>
              Review care plan <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <Alert tone="success" title="Setup complete">
        {recommendationCount}{" "}
        {recommendationCount === 1 ? "care-plan item is" : "care-plan items are"} organized.{" "}
        {historyNeeded} {historyNeeded === 1 ? "item needs" : "items need"} a history answer before
        timing can be more specific.
      </Alert>

      <section aria-labelledby="next-step-heading">
        <div className="mb-4 flex items-center gap-3">
          <Badge tone="brand">
            <Sparkles aria-hidden="true" /> Choose a next step
          </Badge>
          <h2 id="next-step-heading" className="sr-only">
            Choose a next step
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ClipboardCheck,
              title: "Fill in known history",
              description:
                "Use guided backfill and answer only what you know, including unsure or approximate dates.",
              href: `/app/profile/${profile.id}/records/backfill`,
              label: "Start guided backfill",
              available: capabilities.canEdit,
            },
            {
              icon: HeartPulse,
              title: "Go to the dashboard",
              description:
                "See household-level navigation, upcoming timing, and the rest of CareCadence.",
              href: "/app",
              label: "Open dashboard",
              available: true,
            },
            {
              icon: Stethoscope,
              title: "Add a personal plan",
              description:
                "Record a clinician-defined cadence or a custom maintenance routine without changing baseline guidance.",
              href: `/app/profile/${profile.id}/maintenance`,
              label: "Add clinician or custom plan",
              available: capabilities.canEdit,
            },
          ].map(({ icon: Icon, title, description, href, label, available }) => (
            <Card key={title} className="h-full">
              <CardContent className="flex h-full flex-col">
                <span className="bg-brand-soft text-brand grid size-11 place-items-center rounded-2xl">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="font-editorial mt-4 text-2xl font-semibold">{title}</h3>
                <p className="text-ink-soft mt-2 flex-1 text-sm leading-6">{description}</p>
                {available ? (
                  <Button variant="ghost" size="sm" className="mt-4 -ml-3 self-start" asChild>
                    <Link href={href}>
                      {label} <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <p className="text-ink-soft mt-4 text-xs">Edit access is required.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
