import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  Flag,
  HeartPulse,
  MessageCircleQuestion,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PrivacyIndicator } from "@/components/shared/privacy-indicator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/data-display";
import { prisma } from "@/server/db/client";
import { listAccessibleProfiles, loadProfileCarePlan, profileSummary } from "@/server/read-models";

export default async function OverviewPage() {
  const { session, activeProfile: active } = await listAccessibleProfiles();
  if (active === null) {
    return (
      <div className="space-y-7">
        <header>
          <Badge tone="brand">
            <Sparkles aria-hidden="true" /> Private adult preventive care
          </Badge>
          <h1 className="font-editorial mt-4 text-5xl font-semibold tracking-[-0.035em]">
            Welcome to CareCadence.
          </h1>
          <p className="text-ink-soft mt-3 max-w-2xl leading-7">
            Create an adult profile to generate a transparent, source-backed plan without guessing
            at missing history.
          </p>
        </header>
        <EmptyState
          icon={HeartPulse}
          title="No adult profile yet"
          description="The six-step onboarding flow saves drafts and creates the first private profile only when you confirm the review step."
        />
        <Button asChild>
          <Link href="/app/onboarding">
            <Plus aria-hidden="true" /> Create an adult profile
          </Link>
        </Button>
      </div>
    );
  }
  const [plan, plannedActions] = await Promise.all([
    loadProfileCarePlan(active.id),
    prisma.plannedAction.findMany({
      where: { profileId: active.id, status: { in: ["planned", "scheduled"] } },
      orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }],
      take: 3,
    }),
  ]);
  const summary = profileSummary(active);
  const completionPercent =
    summary.denominator === 0 ? 0 : (summary.current / summary.denominator) * 100;
  const overviewPriority: Record<string, number> = {
    overdue: 0,
    due_now: 1,
    needs_date_confirmation: 2,
    due_soon: 3,
    due_this_year: 4,
    unknown_history: 5,
  };
  const attention = plan.recommendations
    .filter(({ status }) => status in overviewPriority)
    .sort((left, right) => overviewPriority[left.status]! - overviewPriority[right.status]!);
  const firstName = (session.user.name ?? active.displayName).split(/\s+/)[0] ?? "there";
  const metrics = [
    {
      label: "Needs attention",
      value: summary.attention,
      detail: "Due or needs confirmation",
      icon: Clock3,
      tone: "warm",
    },
    {
      label: "This year",
      value: summary.thisYear,
      detail: `${plannedActions.length} already planned`,
      icon: CalendarDays,
      tone: "cool",
    },
    {
      label: "History needed",
      value: summary.unknown,
      detail: "Use guided backfill",
      icon: CircleHelp,
      tone: "neutral",
    },
    {
      label: "Discuss",
      value: summary.discussion,
      detail: "Clinician or shared-decision items",
      icon: MessageCircleQuestion,
      tone: "cool",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              <Sparkles aria-hidden="true" /> {active.carePlanMode.replaceAll("_", " ")} mode
            </Badge>
            <Badge tone="neutral">
              {active.displayName} · age {summary.age}
            </Badge>
            <PrivacyIndicator
              label={
                active.visibility === "owner_only"
                  ? "Owner only"
                  : active.visibility === "selected_members"
                    ? "Selected sharing"
                    : "Household shared"
              }
            />
          </div>
          <h1 className="font-editorial mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Welcome back, {firstName}.
          </h1>
          <p className="text-ink-soft mt-2 max-w-2xl text-base leading-7">
            Here is the clearest path through {active.displayName}&apos;s preventive care right now.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/app/profile/${active.id}/visit-prep`}>
              <FileText aria-hidden="true" /> Prepare for a visit
            </Link>
          </Button>
          {active.capabilities.canEdit ? (
            <Button variant="secondary" asChild>
              <Link href={`/app/profile/${active.id}/settings`}>Edit profile</Link>
            </Button>
          ) : null}
          {active.capabilities.canEdit ? (
            <Button asChild>
              <Link href={`/app/profile/${active.id}/records/new`}>
                Add a record <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="sr-only">
          Care plan summary
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]">
          <Card className="bg-brand relative overflow-hidden text-white">
            <CardContent className="flex h-full min-h-40 items-center gap-5">
              <div className="text-ink rounded-full bg-white p-1">
                <ProgressRing
                  value={completionPercent}
                  label="Actionable routine plan completion"
                  size={78}
                />
              </div>
              <div>
                <p className="text-xs font-bold tracking-[0.1em] text-white/70 uppercase">
                  Current routine records
                </p>
                <p className="font-editorial mt-2 text-2xl leading-tight font-semibold">
                  {summary.denominator === 0
                    ? "Plan context is still being built"
                    : `${summary.current} routine ${summary.current === 1 ? "item is" : "items are"} currently recorded`}
                </p>
                <p
                  className="mt-2 text-xs leading-5 text-white/75"
                  title="Includes currently relevant, actionable routine and one-time items. Excludes future, unknown-history, discussion, clinician-managed, insufficient-evidence, and non-applicable guidance."
                >
                  {summary.denominator} currently actionable routine{" "}
                  {summary.denominator === 1 ? "item" : "items"}; future, unknown, and discussion
                  items are excluded. This is not a health score.
                </p>
              </div>
            </CardContent>
          </Card>
          {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
            <Card
              key={label}
              className="hover:border-line-strong transition duration-200 hover:-translate-y-0.5"
            >
              <CardContent className="min-h-40">
                <div
                  className={`grid size-10 place-items-center rounded-xl ${tone === "warm" ? "bg-accent-soft text-accent" : tone === "cool" ? "bg-sky-soft text-sky" : "bg-surface-muted text-ink-soft"}`}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </div>
                <p className="font-editorial mt-4 text-3xl font-semibold">{value}</p>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-ink-soft mt-1 text-xs">{detail}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="hover:border-line-strong transition duration-200 hover:-translate-y-0.5">
            <CardContent className="min-h-40">
              <div className="bg-brand-soft text-brand grid size-10 place-items-center rounded-xl">
                <Flag aria-hidden="true" className="size-5" />
              </div>
              <p className="font-editorial mt-4 text-2xl font-semibold">
                {plan.nextAgeMilestone === null
                  ? "None queued"
                  : `Age ${plan.nextAgeMilestone.age}`}
              </p>
              <p className="text-sm font-semibold">Next age milestone</p>
              <p className="text-ink-soft mt-1 text-xs leading-5">
                {plan.nextAgeMilestone === null
                  ? "No future boundary in the active plan"
                  : `${plan.nextAgeMilestone.service} · ${new Date(`${plan.nextAgeMilestone.date}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        aria-labelledby="next-actions-title"
        className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]"
      >
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">Start here</p>
              <h2
                id="next-actions-title"
                className="font-editorial mt-1 text-3xl font-semibold tracking-[-0.025em]"
              >
                Your next actions
              </h2>
            </div>
            <Link
              href={`/app/profile/${active.id}/care-plan`}
              className="text-brand-strong text-sm font-semibold hover:underline"
            >
              View full plan
            </Link>
          </div>
          {plan.recommendations.length === 0 ? (
            <EmptyState
              icon={CircleHelp}
              title="No active recommendations yet"
              description="The profile is saved. Seed or activate the reviewed rule catalog to generate source-backed recommendations."
            />
          ) : attention.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No items need attention right now"
              description="The full care plan still keeps future, current, discussion, and reference items available."
            />
          ) : (
            <div className="space-y-3">
              {attention.slice(0, 3).map((item, index) => (
                <Card
                  key={item.id}
                  className="group hover:border-line-strong overflow-hidden transition"
                >
                  <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <span className="font-editorial bg-surface-muted text-ink-soft grid size-10 place-items-center rounded-full text-lg font-semibold">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.service}</h3>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-ink-soft mt-2 text-sm leading-6">{item.reason}</p>
                      <p className="text-ink-soft mt-2 text-xs font-semibold">
                        {item.timing} · {item.source}
                      </p>
                      <p className="text-ink-soft mt-1 text-xs">{item.history}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {active.capabilities.canEdit ? (
                        <Button variant="quiet" size="sm" asChild>
                          <Link
                            href={
                              item.status === "unknown_history" ||
                              item.status === "needs_date_confirmation"
                                ? `/app/profile/${active.id}/records/backfill`
                                : `/app/profile/${active.id}/calendar?plan=${item.id}`
                            }
                          >
                            {item.status === "unknown_history" ||
                            item.status === "needs_date_confirmation"
                              ? "Add history"
                              : "Plan"}
                          </Link>
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/app/profile/${active.id}/care-plan/${item.id}`}>
                          Details <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <aside className="space-y-4" aria-label="Upcoming planning">
          <Card className="overflow-hidden">
            <div className="border-line bg-accent-soft/70 border-b p-5">
              <CalendarDays aria-hidden="true" className="text-accent size-5" />
              <h2 className="font-editorial mt-3 text-2xl font-semibold">Annual roadmap</h2>
              <p className="text-ink-soft mt-1 text-sm">
                {plannedActions.length} {plannedActions.length === 1 ? "action is" : "actions are"}{" "}
                planned.
              </p>
            </div>
            <CardContent className="space-y-4">
              {plannedActions.length === 0 ? (
                <p className="text-ink-soft text-sm">
                  Choose “Plan” on a recommendation to organize a month without changing its medical
                  due window.
                </p>
              ) : (
                plannedActions.map((action) => (
                  <div key={action.id} className="border-line border-l pl-4">
                    <p className="text-sm font-semibold">{action.title}</p>
                    <p className="text-ink-soft mt-1 text-xs">
                      {action.appointmentStart?.toLocaleString("en-US", {
                        timeZone: action.timezone,
                      }) ??
                        (action.plannedMonth === null
                          ? "Planned"
                          : `Planned for ${action.plannedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`)}
                    </p>
                  </div>
                ))
              )}
              <Button variant="secondary" className="w-full" asChild>
                <Link href={`/app/profile/${active.id}/calendar`}>Open roadmap</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-brand/25 bg-brand-soft/70">
            <CardContent>
              <ShieldCheck aria-hidden="true" className="text-brand size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">
                Your sources are visible
              </h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Every item includes its rule version, source provenance, calculation, and known
                limitations.
              </p>
              <Button variant="ghost" className="mt-3 -ml-3" asChild>
                <Link href="/app/sources">
                  Browse sources <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Quick actions">
        {[
          ...(active.capabilities.canEdit
            ? [
                [
                  ClipboardCheck,
                  "Continue backfill",
                  "Answer high-impact history questions",
                  `/app/profile/${active.id}/records/backfill`,
                ] as const,
              ]
            : []),
          [
            HeartPulse,
            "Review the full plan",
            "See routine, discussion, and personal-plan items",
            `/app/profile/${active.id}/care-plan`,
          ] as const,
          [
            FileText,
            "Prepare for a visit",
            "Build a concise one-page agenda",
            `/app/profile/${active.id}/visit-prep`,
          ] as const,
        ].map(([Icon, title, description, href]) => {
          const ActionIcon = Icon as typeof ClipboardCheck;
          return (
            <Link key={String(title)} href={String(href)}>
              <Card className="hover:border-brand/40 h-full transition hover:-translate-y-0.5">
                <CardContent>
                  <ActionIcon aria-hidden="true" className="text-brand size-5" />
                  <h3 className="font-editorial mt-4 text-xl font-semibold">{String(title)}</h3>
                  <p className="text-ink-soft mt-2 text-sm leading-6">{String(description)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
