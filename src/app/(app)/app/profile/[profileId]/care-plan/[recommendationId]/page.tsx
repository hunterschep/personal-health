import {
  ArrowLeft,
  Beaker,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleHelp,
  FileClock,
  History,
  ListChecks,
  MessageCircleQuestion,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadOnlyGuidelineVariants } from "@/components/care-plan/read-only-guideline-variants";
import { GuidelineVariantSelector } from "@/components/care-plan/guideline-variant-selector";
import { ClinicianOverrideActions } from "@/components/care-plan/clinician-override-actions";
import { RecommendationResponseActions } from "@/components/care-plan/recommendation-response-actions";
import { LinkedDocumentManager } from "@/components/documents/linked-document-manager";
import { PageHeader } from "@/components/shared/page-header";
import { AttributionBlock, SourceMetadataPanel, StaleSourceWarning } from "@/components/sources";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { loadRecommendationDetail } from "@/server/read-models/recommendation-detail";
import {
  humanizeIdentifier,
  safeTokenValue,
  type StoredDateRange,
} from "@/server/read-models/transparency-format";

function dateLabel(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateRangeLabel(start: Date | null, end: Date | null): string {
  if (start === null) return "Timing depends on history or a clinician discussion";
  if (end === null || start.getTime() === end.getTime()) return dateLabel(start);
  return `${dateLabel(start)} – ${dateLabel(end)}`;
}

function storedRangeLabel(range: StoredDateRange | null): string {
  if (range === null || range.start === null) return "Not separately calculated";
  const start = dateLabel(new Date(`${range.start}T00:00:00.000Z`));
  if (range.end === null || range.end === range.start) return start;
  return `${start} – ${dateLabel(new Date(`${range.end}T00:00:00.000Z`))}`;
}

function eventTiming(
  start: Date | null,
  end: Date | null,
  precision: "day" | "month" | "year" | "unknown",
): string {
  if (precision === "unknown" || start === null) return "Completed, date unknown";
  if (precision === "year") return `${start.getUTCFullYear()} · year only`;
  if (precision === "month") {
    return `${start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })} · month only`;
  }
  return dateRangeLabel(start, end);
}

function timestampLabel(value: Date, timeZone?: string): string {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone === undefined ? {} : { timeZone }),
  });
}

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ profileId: string; recommendationId: string }>;
}) {
  const { profileId, recommendationId } = await params;
  const detail = await loadRecommendationDetail(profileId, recommendationId);
  if (detail === null) notFound();

  const { profile, recommendation, rule, capabilities } = detail;
  const activeVariants = detail.variants.filter((variant) => variant.current);
  const archivedVariants = detail.variants.filter((variant) => !variant.current);
  const hasPersonalPlan =
    detail.personalPlan.override !== null ||
    detail.personalPlan.pausedOverride !== null ||
    detail.personalPlan.plannedActions.length > 0 ||
    detail.personalPlan.reminders.length > 0;

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={`/app/profile/${profile.id}/care-plan`}>
          <ArrowLeft aria-hidden="true" /> Back to care plan
        </Link>
      </Button>

      <PageHeader
        eyebrow={humanizeIdentifier(recommendation.service.category)}
        title={recommendation.service.name}
        description={`A transparent view of why this appears for ${profile.displayName}, how timing was calculated, and which reviewed source version controls it.`}
        actions={
          capabilities.canEdit ? (
            <>
              <Button variant="secondary" asChild>
                <Link
                  href={`/app/profile/${profile.id}/records/new?service=${recommendation.service.slug}`}
                >
                  Add past record
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/app/profile/${profile.id}/calendar?plan=${recommendation.id}`}>
                  <CalendarPlus aria-hidden="true" /> Plan this
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      {detail.source?.freshness === "review_due" ? <StaleSourceWarning /> : null}

      <Card className="border-accent/25 overflow-hidden">
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={recommendation.status} />
              <Badge tone="brand">{rule.recommendationClass}</Badge>
              {rule.evidenceGrade === null ? null : <Badge tone="warm">{rule.evidenceGrade}</Badge>}
              {detail.personalPlan.override === null ? null : (
                <Badge tone="cool">Personal clinician plan</Badge>
              )}
            </div>
            <h2 className="font-editorial mt-4 text-3xl font-semibold">{rule.consumerSummary}</h2>
            <p className="text-ink-soft mt-3 max-w-3xl leading-7">{rule.whyItMatters}</p>
          </div>
          <div className="bg-accent-soft min-w-64 rounded-2xl p-5 text-center">
            <CalendarClock aria-hidden="true" className="text-accent mx-auto size-6" />
            <p className="text-ink-soft mt-2 text-xs font-bold tracking-wider uppercase">
              Organizer timing
            </p>
            <p className="font-editorial mt-1 text-2xl font-semibold">
              {dateRangeLabel(recommendation.dueStart, recommendation.dueEnd)}
            </p>
            <p className="text-ink-soft mt-2 text-xs">
              Evaluated {dateLabel(recommendation.evaluatedAsOf)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" className="text-brand mt-1 size-5 shrink-0" />
                <div>
                  <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                    Profile fit
                  </p>
                  <h2 className="font-editorial mt-1 text-2xl font-semibold">
                    Why this appears for {profile.displayName}
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border-line bg-surface-muted/45 rounded-xl border p-4 sm:col-span-2">
                  <p className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                    Reviewed eligibility logic
                  </p>
                  <p className="mt-2 text-sm leading-6">{rule.eligibility}</p>
                  {rule.exclusions === null ? null : (
                    <p className="text-ink-soft mt-2 text-sm leading-6">
                      Exclusion check: {rule.exclusions}
                    </p>
                  )}
                </div>
                {detail.matchingFacts.length === 0 ? (
                  <div className="border-line rounded-xl border p-4 sm:col-span-2">
                    <CircleHelp aria-hidden="true" className="text-ink-soft size-5" />
                    <p className="mt-2 text-sm font-semibold">
                      No additional matching fact was stored
                    </p>
                    <p className="text-ink-soft mt-1 text-xs leading-5">
                      The reviewed rule summary above remains the readable eligibility explanation.
                    </p>
                  </div>
                ) : (
                  detail.matchingFacts.map((fact, index) => {
                    const value = safeTokenValue(fact.value);
                    return (
                      <div
                        key={`${fact.code}-${fact.label}-${index}`}
                        className="border-line rounded-xl border p-4"
                      >
                        <CheckCircle2 aria-hidden="true" className="text-brand size-5" />
                        <p className="mt-3 text-sm font-semibold">{fact.label}</p>
                        {value === null ? null : (
                          <p className="text-ink-soft mt-1 text-xs leading-5">{value}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <CalendarClock aria-hidden="true" className="text-accent mt-1 size-5 shrink-0" />
                <div>
                  <p className="text-accent text-xs font-bold tracking-[0.1em] uppercase">
                    Calculation
                  </p>
                  <h2 className="font-editorial mt-1 text-2xl font-semibold">
                    Timing and uncertainty
                  </h2>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border-line rounded-xl border p-4">
                  <dt className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                    Current due range
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {dateRangeLabel(recommendation.dueStart, recommendation.dueEnd)}
                  </dd>
                </div>
                <div className="border-line rounded-xl border p-4">
                  <dt className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                    General guideline
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {storedRangeLabel(detail.calculation.generalGuidelineDueRange)}
                  </dd>
                </div>
                <div className="border-line rounded-xl border p-4">
                  <dt className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                    Personal timing
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {storedRangeLabel(detail.calculation.personalDueRange)}
                  </dd>
                </div>
                <div className="border-line rounded-xl border p-4">
                  <dt className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                    Schedule behavior
                  </dt>
                  <dd className="mt-2 text-sm leading-6">{rule.schedule}</dd>
                </div>
              </dl>

              <div className="bg-surface-muted/60 mt-4 rounded-xl p-4 text-sm leading-6">
                <p className="font-semibold">Start and stop behavior</p>
                <p className="text-ink-soft mt-1">
                  Rule effective {dateLabel(rule.effectiveFrom)} –{" "}
                  {rule.effectiveTo === null ? "open-ended" : dateLabel(rule.effectiveTo)}.
                  {rule.stopBehavior === null
                    ? " Eligibility and schedule bounds control when routine guidance changes."
                    : ` Separate stop condition: ${rule.stopBehavior}.`}
                </p>
              </div>

              {capabilities.canEdit ? (
                <RecommendationResponseActions
                  profileId={profile.id}
                  serviceId={recommendation.service.id}
                  currentResponse={detail.personalPlan.response?.state ?? null}
                  currentReason={detail.personalPlan.response?.reason ?? null}
                  reminder={detail.personalPlan.reminders[0] ?? null}
                />
              ) : null}

              <Accordion type="multiple" defaultValue={["trace"]} className="mt-4">
                <AccordionItem value="trace">
                  <AccordionTrigger>Exact calculation trace</AccordionTrigger>
                  <AccordionContent>
                    {detail.calculation.trace.length === 0 ? (
                      <p>No stored calculation trace is available for this snapshot.</p>
                    ) : (
                      <ol className="space-y-3">
                        {detail.calculation.trace.map((step, index) => (
                          <li
                            key={`${step.step}-${index}`}
                            className="border-line rounded-xl border p-3"
                          >
                            <p className="font-semibold">
                              {index + 1}. {step.step}
                            </p>
                            <p className="text-ink-soft mt-1">{step.outcome}</p>
                            {step.values.length === 0 ? null : (
                              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                {step.values.map((value) => (
                                  <div key={value.label} className="flex gap-1">
                                    <dt className="text-ink-soft">{value.label}:</dt>
                                    <dd>{String(value.value)}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tokens">
                  <AccordionTrigger>Calculation explanations</AccordionTrigger>
                  <AccordionContent>
                    {detail.calculation.tokens.length === 0 ? (
                      <p>No separate explanation tokens are stored for this snapshot.</p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.calculation.tokens.map((token, index) => {
                          const value = safeTokenValue(token.value);
                          return (
                            <li key={`${token.code}-${token.label}-${index}`}>
                              <span className="font-semibold">{token.label}</span>
                              {value === null ? null : (
                                <span className="text-ink-soft"> · {value}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <Beaker aria-hidden="true" className="text-sky mt-1 size-5 shrink-0" />
                <div>
                  <p className="text-sky text-xs font-bold tracking-[0.1em] uppercase">
                    Method integrity
                  </p>
                  <h2 className="font-editorial mt-1 text-2xl font-semibold">Accepted methods</h2>
                </div>
              </div>
              {detail.methods.length === 0 ? (
                <p className="text-ink-soft mt-5 text-sm leading-6">
                  This reviewed item is a discussion, one-time review, or service without a
                  method-specific interval. No test method is inferred.
                </p>
              ) : (
                <div className="border-line mt-5 divide-y rounded-xl border">
                  {detail.methods.map((method) => (
                    <div
                      key={method.id}
                      className="grid gap-2 p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-start"
                    >
                      <p className="font-semibold">{method.name}</p>
                      <p className="text-ink-soft text-sm leading-6">{method.description}</p>
                      <Badge tone={method.interval === null ? "neutral" : "brand"}>
                        {method.interval ?? "Accepted method"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {detail.methods.some((method) => method.interval !== null) ? (
                <p className="text-ink-soft mt-4 text-xs leading-5">
                  The next interval follows the method actually completed. CareCadence never
                  substitutes a longer interval from another method.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <History aria-hidden="true" className="text-brand mt-1 size-5 shrink-0" />
                  <div>
                    <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                      Recorded care
                    </p>
                    <h2 className="font-editorial mt-1 text-2xl font-semibold">History</h2>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/app/profile/${profile.id}/records`}>Open all records</Link>
                </Button>
              </div>
              {detail.history.length === 0 ? (
                <div className="bg-surface-muted/55 mt-5 rounded-xl p-4">
                  <p className="font-semibold">No related care event is recorded</p>
                  <p className="text-ink-soft mt-1 text-sm leading-6">
                    Exact, month-only, year-only, and unknown dates can all be recorded without
                    inventing precision.
                  </p>
                </div>
              ) : (
                <div className="border-line mt-5 divide-y rounded-xl border">
                  {detail.history.map((event) => (
                    <Link
                      key={event.id}
                      href={`/app/profile/${profile.id}/records/${event.id}`}
                      className="hover:bg-surface-muted/45 grid gap-3 p-4 transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {event.method ?? recommendation.service.name}
                          </p>
                          {event.qualifying ? (
                            <Badge tone="brand">Used in calculation</Badge>
                          ) : null}
                          {event.datePrecision !== "day" ? <Badge>Approximate date</Badge> : null}
                        </div>
                        <p className="text-ink-soft mt-1 text-sm">
                          {eventTiming(
                            event.performedStart,
                            event.performedEnd,
                            event.datePrecision,
                          )}
                          {event.providerName === null ? "" : ` · ${event.providerName}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          tone={
                            event.result === "normal"
                              ? "brand"
                              : event.result === "unknown"
                                ? "neutral"
                                : "warm"
                          }
                        >
                          {humanizeIdentifier(event.result)}
                        </Badge>
                        {event.documentCount > 0 ? (
                          <Badge>{event.documentCount} document</Badge>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <Stethoscope aria-hidden="true" className="text-sky mt-1 size-5 shrink-0" />
                <div>
                  <p className="text-sky text-xs font-bold tracking-[0.1em] uppercase">
                    User planning
                  </p>
                  <h2 className="font-editorial mt-1 text-2xl font-semibold">Personal plan</h2>
                </div>
              </div>
              {!hasPersonalPlan ? (
                <div className="bg-surface-muted/55 mt-5 rounded-xl p-4">
                  <p className="font-semibold">No personal instruction or plan is active</p>
                  <p className="text-ink-soft mt-1 text-sm leading-6">
                    General reviewed guidance remains visible. Planning a month does not change its
                    due calculation.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {detail.personalPlan.override === null ? null : (
                    <div className="border-sky/25 bg-sky-soft/45 rounded-xl border p-4 lg:col-span-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="cool">Clinician instruction</Badge>
                        <Badge>{humanizeIdentifier(detail.personalPlan.override.type)}</Badge>
                      </div>
                      <p className="mt-3 font-semibold">
                        {dateRangeLabel(
                          detail.personalPlan.override.nextDueStart,
                          detail.personalPlan.override.nextDueEnd,
                        )}
                      </p>
                      <p className="text-ink-soft mt-2 text-sm leading-6">
                        Received {dateLabel(detail.personalPlan.override.instructionReceivedDate)}
                        {detail.personalPlan.override.clinicianName === null
                          ? ""
                          : ` from ${detail.personalPlan.override.clinicianName}`}
                        {detail.personalPlan.override.method === null
                          ? ""
                          : ` · ${detail.personalPlan.override.method}`}
                      </p>
                      {detail.personalPlan.override.reason === null ? null : (
                        <p className="mt-2 text-sm leading-6">
                          {detail.personalPlan.override.reason}
                        </p>
                      )}
                      {capabilities.canEdit ? (
                        <ClinicianOverrideActions
                          profileId={profile.id}
                          recommendationId={recommendation.id}
                          overrideId={detail.personalPlan.override.id}
                          paused={false}
                        />
                      ) : null}
                      <LinkedDocumentManager
                        profileId={profile.id}
                        clinicianOverrideId={detail.personalPlan.override.id}
                        documents={detail.personalPlan.override.documents}
                        editable={capabilities.canEdit}
                        label="Clinician instruction attachment"
                      />
                    </div>
                  )}
                  {detail.personalPlan.pausedOverride === null ? null : (
                    <div className="border-line bg-surface-muted/55 rounded-xl border p-4 lg:col-span-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>Paused clinician instruction</Badge>
                        <Badge>{humanizeIdentifier(detail.personalPlan.pausedOverride.type)}</Badge>
                      </div>
                      <p className="text-ink-soft mt-3 text-sm leading-6">
                        Paused {timestampLabel(detail.personalPlan.pausedOverride.pausedAt)}.
                        General reviewed guidance currently controls the care-plan status.
                      </p>
                      {capabilities.canEdit ? (
                        <ClinicianOverrideActions
                          profileId={profile.id}
                          recommendationId={recommendation.id}
                          overrideId={detail.personalPlan.pausedOverride.id}
                          paused
                        />
                      ) : null}
                      <LinkedDocumentManager
                        profileId={profile.id}
                        clinicianOverrideId={detail.personalPlan.pausedOverride.id}
                        documents={detail.personalPlan.pausedOverride.documents}
                        editable={capabilities.canEdit}
                        label="Clinician instruction attachment"
                      />
                    </div>
                  )}
                  {detail.personalPlan.plannedActions.map((action) => (
                    <div key={action.id} className="border-line rounded-xl border p-4">
                      <Badge tone="brand">{humanizeIdentifier(action.status)}</Badge>
                      <p className="mt-3 font-semibold">{action.title}</p>
                      <p className="text-ink-soft mt-1 text-sm leading-6">
                        {action.appointmentStart !== null
                          ? timestampLabel(action.appointmentStart, action.timezone)
                          : action.plannedMonth !== null
                            ? `Planned for ${action.plannedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`
                            : "Planned without a selected month"}
                      </p>
                    </div>
                  ))}
                  {detail.personalPlan.reminders.map((reminder) => (
                    <div key={reminder.id} className="border-line rounded-xl border p-4">
                      <Badge>{humanizeIdentifier(reminder.channel)} reminder</Badge>
                      <p className="mt-3 font-semibold">
                        {reminder.snoozedUntil === null ? "" : "Snoozed until "}
                        {timestampLabel(reminder.remindAt, profile.timezone)}
                      </p>
                      <p className="text-ink-soft mt-1 text-xs">
                        Reminder timing does not alter medical status.
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {detail.personalPlan.override === null && capabilities.canEdit ? (
                <Button variant="secondary" size="sm" className="mt-4" asChild>
                  <Link href={`/app/profile/${profile.id}/care-plan/${recommendation.id}/override`}>
                    Add clinician instruction
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {activeVariants.length > 1 || recommendation.conflictGroup !== null ? (
            <section aria-labelledby="variant-heading">
              <div className="mb-4">
                <p className="text-sky text-xs font-bold tracking-[0.1em] uppercase">
                  Guidelines differ
                </p>
                <h2 id="variant-heading" className="font-editorial text-3xl font-semibold">
                  Guideline variants
                </h2>
                <p className="text-ink-soft mt-2 max-w-3xl text-sm leading-6">
                  The selected variant controls organizer timing. Alternatives remain visible, and
                  choosing one does not establish clinical truth.
                </p>
              </div>
              <ReadOnlyGuidelineVariants variants={detail.variants} />
              {recommendation.conflictGroup === null || !capabilities.canEdit ? null : (
                <GuidelineVariantSelector
                  profileId={profile.id}
                  conflictGroup={recommendation.conflictGroup}
                  explicitSelection={detail.guidelineSelectionExplicit}
                  variants={activeVariants.map((variant) => ({
                    variantId: variant.variantId,
                    baseline: variant.baseline,
                    selected: variant.selected,
                    organization:
                      variant.source?.metadata.organization ??
                      humanizeIdentifier(variant.variantId),
                  }))}
                />
              )}
              {archivedVariants.length > 0 ? (
                <p className="text-ink-soft mt-3 text-xs">
                  {archivedVariants.length} inactive or retired rule{" "}
                  {archivedVariants.length === 1 ? "version remains" : "versions remain"} in the
                  source archive.
                </p>
              ) : null}
            </section>
          ) : null}

          <Card>
            <CardContent>
              <h2 className="font-editorial text-2xl font-semibold">
                Benefits, limitations, and questions
              </h2>
              <Accordion
                type="multiple"
                defaultValue={["benefits", "limitations", "questions"]}
                className="mt-3"
              >
                <AccordionItem value="benefits">
                  <AccordionTrigger>Why it may matter</AccordionTrigger>
                  <AccordionContent>{rule.whyItMatters}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="limitations">
                  <AccordionTrigger>Known limitations</AccordionTrigger>
                  <AccordionContent>
                    {rule.limitations.length === 0 ? (
                      <p>No separate limitation summary is stored for this rule.</p>
                    ) : (
                      <ul className="list-disc space-y-2 pl-5">
                        {rule.limitations.map((limitation) => (
                          <li key={limitation}>{limitation}</li>
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="questions">
                  <AccordionTrigger>Questions for a clinician</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc space-y-2 pl-5">
                      {rule.questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          {detail.source === null ? (
            <Alert tone="warning" title="Source registry metadata unavailable">
              The stored rule remains visible, but its public registry entry could not be loaded.
            </Alert>
          ) : (
            <>
              <SourceMetadataPanel source={detail.source.metadata} />
              <AttributionBlock attribution={detail.source.metadata.attribution} />
              <Button variant="secondary" className="w-full" asChild>
                <Link href={`/app/sources/services/${recommendation.service.slug}`}>
                  Compare service sources
                </Link>
              </Button>
            </>
          )}

          <Card>
            <CardContent>
              <ListChecks aria-hidden="true" className="text-brand size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Rule identity</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink-soft">Stable key</dt>
                  <dd className="mt-1 font-mono text-xs break-words">{rule.stableKey}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Version</dt>
                  <dd className="mt-1 font-semibold">{rule.version}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Variant</dt>
                  <dd className="mt-1 font-semibold">
                    {humanizeIdentifier(recommendation.variantId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Last rule review</dt>
                  <dd className="mt-1 font-semibold">{dateLabel(rule.reviewedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <FileClock aria-hidden="true" className="text-accent size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Change history</h2>
              {detail.changeHistory.length === 0 ? (
                <p className="text-ink-soft mt-2 text-sm leading-6">
                  No prior calculation or source revision is recorded.
                </p>
              ) : (
                <ol className="border-line mt-4 space-y-4 border-l pl-4">
                  {detail.changeHistory.slice(0, 8).map((change) => (
                    <li key={`${change.kind}-${change.id}`} className="relative">
                      <span className="bg-brand absolute top-1.5 -left-[1.22rem] size-2 rounded-full" />
                      <p className="text-sm font-semibold">{change.title}</p>
                      <p className="text-ink-soft mt-1 text-xs leading-5">{change.description}</p>
                      <p className="text-ink-soft mt-1 text-[0.7rem]">
                        {dateLabel(change.occurredAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="border-sky/20 bg-sky-soft/45">
            <CardContent>
              <MessageCircleQuestion aria-hidden="true" className="text-sky size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Bring this to a visit</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Review the recorded history, uncertainty, and source variant with a clinician before
                making a care decision.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Alert tone="warning" title="CareCadence is an organizer">
        It does not diagnose conditions, replace medical advice, or determine whether a specific
        test, vaccine, or procedure is safe or appropriate.
      </Alert>
    </div>
  );
}
