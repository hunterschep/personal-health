import { ClinicianOverrideForm } from "@/components/care-plan/clinician-override-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { notFound } from "next/navigation";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

export default async function OverridePage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string; recommendationId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { profileId, recommendationId } = await params;
  const { edit } = await searchParams;
  const { profile } = await requireProfilePageAccess(profileId, "edit");
  const recommendation = await prisma.recommendationInstance.findFirst({
    where: { id: recommendationId, profileId: profile.id, retiredAt: null },
    select: { id: true, serviceId: true },
  });
  if (recommendation === null) notFound();
  const existing =
    edit === undefined
      ? null
      : await prisma.clinicianOverride.findFirst({
          where: {
            id: edit,
            profileId: profile.id,
            serviceId: recommendation.serviceId,
            active: true,
          },
        });
  if (edit !== undefined && existing === null) notFound();
  const interval =
    existing?.intervalJson !== null &&
    existing?.intervalJson !== undefined &&
    typeof existing.intervalJson === "object" &&
    !Array.isArray(existing.intervalJson)
      ? existing.intervalJson
      : null;
  const isoDate = (value: Date | null | undefined): string =>
    value === null || value === undefined ? "" : value.toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Personal clinician plan"
        title={existing === null ? "Add clinician instruction" : "Edit clinician instruction"}
        description="Record the schedule you were actually given. CareCadence will not infer treatment or follow-up timing."
      />
      <Card>
        <CardContent>
          <ClinicianOverrideForm
            profileId={profile.id}
            serviceId={existing === null ? recommendation.id : recommendation.serviceId}
            {...(existing === null
              ? {}
              : {
                  initial: {
                    id: existing.id,
                    type: existing.overrideType,
                    nextDueStart: isoDate(existing.nextDueStart),
                    nextDueEnd: isoDate(existing.nextDueEnd),
                    ...(typeof interval?.value === "number"
                      ? { intervalValue: interval.value }
                      : {}),
                    ...(interval?.unit === "days" ||
                    interval?.unit === "weeks" ||
                    interval?.unit === "months" ||
                    interval?.unit === "years"
                      ? { intervalUnit: interval.unit }
                      : {}),
                    instructionReceivedDate: isoDate(existing.instructionReceivedDate),
                    clinicianName: existing.clinicianName ?? "",
                    practiceName: existing.practiceName ?? "",
                    reason: existing.reason ?? "",
                    reviewDate: isoDate(existing.reviewDate),
                    replacesGeneralGuideline: existing.replacesGeneralGuideline,
                  },
                })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
