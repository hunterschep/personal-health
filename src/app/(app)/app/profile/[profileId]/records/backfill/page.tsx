import { BackfillQueue } from "@/components/records/backfill-queue";
import { HistoryAssertions } from "@/components/records/history-assertions";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

export default async function BackfillPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { profile } = await requireProfilePageAccess(profileId, "edit");
  const [recommendations, historyStates] = await Promise.all([
    prisma.recommendationInstance.findMany({
      where: {
        profileId: profile.id,
        retiredAt: null,
        status: { in: ["unknown_history", "needs_date_confirmation"] },
      },
      include: {
        service: {
          include: { methods: { where: { active: true }, orderBy: { name: "asc" } } },
        },
        lastQualifyingEvent: true,
      },
      orderBy: [{ status: "asc" }, { service: { sortOrder: "asc" } }],
    }),
    prisma.profileServiceHistoryState.findMany({
      where: { profileId: profile.id },
      include: { service: { select: { name: true } } },
      orderBy: { recordedAt: "desc" },
    }),
  ]);
  const stateByService = new Map(historyStates.map((state) => [state.serviceId, state.state]));
  const questions = recommendations
    .filter((recommendation) => {
      const state = stateByService.get(recommendation.serviceId);
      if (state === "no_record") return false;
      return recommendation.status === "needs_date_confirmation" || state === undefined;
    })
    .map((recommendation) => ({
      serviceId: recommendation.serviceId,
      service: recommendation.service.name,
      eventId:
        recommendation.status === "needs_date_confirmation"
          ? recommendation.lastQualifyingEventId
          : null,
      refining: recommendation.status === "needs_date_confirmation",
      why:
        recommendation.status === "needs_date_confirmation"
          ? "A more precise date can narrow the future due window without inventing a day."
          : "This answer is one of the highest-impact gaps in the current plan.",
      methods: recommendation.service.methods.map((method) => ({
        id: method.id,
        name: method.name,
      })),
      existingEvent:
        recommendation.lastQualifyingEvent === null
          ? null
          : {
              methodId: recommendation.lastQualifyingEvent.methodId,
              precision: recommendation.lastQualifyingEvent.datePrecision,
              date:
                recommendation.lastQualifyingEvent.performedStart === null
                  ? ""
                  : recommendation.lastQualifyingEvent.datePrecision === "year"
                    ? recommendation.lastQualifyingEvent.performedStart.toISOString().slice(0, 4)
                    : recommendation.lastQualifyingEvent.datePrecision === "month"
                      ? recommendation.lastQualifyingEvent.performedStart.toISOString().slice(0, 7)
                      : recommendation.lastQualifyingEvent.performedStart
                          .toISOString()
                          .slice(0, 10),
              result: recommendation.lastQualifyingEvent.result,
              providerName: recommendation.lastQualifyingEvent.providerName ?? "",
              note: recommendation.lastQualifyingEvent.notes ?? "",
            },
    }));
  const reversibleAssertions = historyStates.flatMap((state) =>
    state.state === "never_completed" ||
    state.state === "unsure" ||
    state.state === "not_applicable_claim"
      ? [
          {
            serviceId: state.serviceId,
            service: state.service.name,
            state: state.state,
            reason: state.reason,
            recordedAt: state.recordedAt.toISOString(),
          },
        ]
      : [],
  );
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Guided history"
        title="Fill the highest-impact gaps"
        description="Only relevant questions appear. You can use an exact date, month, year, date unknown, not sure, or skip."
      />
      <BackfillQueue
        profileId={profile.id}
        questions={questions}
        skippedCount={historyStates.filter(({ state }) => state === "no_record").length}
      />
      <HistoryAssertions profileId={profile.id} assertions={reversibleAssertions} />
    </div>
  );
}
