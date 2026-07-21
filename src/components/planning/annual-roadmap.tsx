"use client";

import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Repeat2,
  Stethoscope,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoadmapBucket } from "./roadmap-placement";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type RoadmapItemStatus = "medical" | "planned" | "appointment" | "reminder" | "maintenance";
export type { RoadmapBucket } from "./roadmap-placement";

export type RoadmapPlan = {
  id: string;
  title: string;
  month: number | null;
  bucket: RoadmapBucket | null;
  status: RoadmapItemStatus;
  timing: string;
  serviceId: string | null;
  recommendationId: string | null;
  persisted: boolean;
  startDate: string | null;
  endDate: string | null;
  appointmentStartLocal: string | null;
  appointmentEndLocal: string | null;
  reminderDaysBefore: number | null;
  location: string | null;
  notes: string | null;
  detailHref: string | null;
};

type PlannableRoadmapPlan = RoadmapPlan & {
  status: "medical" | "planned" | "appointment";
  serviceId: string;
};

export function isRoadmapItemPlannable(plan: RoadmapPlan): plan is PlannableRoadmapPlan {
  return (
    plan.serviceId !== null &&
    (plan.status === "medical" || plan.status === "planned" || plan.status === "appointment")
  );
}

const statusMetadata: Record<
  RoadmapItemStatus,
  {
    label: string;
    icon: LucideIcon;
    className: string;
  }
> = {
  medical: {
    label: "Medical timing",
    icon: Stethoscope,
    className: "rounded-lg border-sky/40 border-l-4 bg-sky-soft/70",
  },
  planned: {
    label: "Personal plan",
    icon: CalendarPlus,
    className: "rounded-lg border-brand/40 border-dashed bg-brand-soft/70",
  },
  appointment: {
    label: "Appointment",
    icon: CalendarDays,
    className: "rounded-2xl border-sky/45 bg-surface-raised ring-1 ring-sky/10",
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    className: "rounded-full border-accent/45 border-dashed bg-accent-soft/75",
  },
  maintenance: {
    label: "Personal cadence",
    icon: Repeat2,
    className: "rounded-sm border-brand/35 border-double bg-surface-muted/75",
  },
};

export function roadmapItemAppearsInMonth(plan: RoadmapPlan, month: number): boolean {
  return plan.month === month;
}

export function roadmapDayInMonth(plan: RoadmapPlan, year: number, month: number): number | null {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  if (plan.startDate === null || !plan.startDate.startsWith(prefix)) return null;
  if (plan.status === "medical" && (plan.endDate === null || plan.endDate !== plan.startDate)) {
    return null;
  }
  return Number(plan.startDate.slice(-2));
}

function RoadmapItemButton({
  plan,
  onSelect,
  compact = false,
}: {
  plan: RoadmapPlan;
  onSelect: (plan: RoadmapPlan) => void;
  compact?: boolean;
}) {
  const metadata = statusMetadata[plan.status];
  const Icon = metadata.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      aria-haspopup="dialog"
      aria-label={`${metadata.label}: ${plan.title}. ${plan.timing}`}
      className={`focus-visible:outline-brand border text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
        metadata.className
      } ${compact ? "w-full p-2 text-[0.68rem]" : "w-full p-3 text-sm"}`}
    >
      <span className="flex items-center gap-1.5 font-bold tracking-[0.04em] uppercase">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {metadata.label}
      </span>
      <span className={`block font-semibold normal-case ${compact ? "mt-1" : "mt-1.5"}`}>
        {plan.title}
      </span>
      <span className="text-ink-soft mt-1 block normal-case">{plan.timing}</span>
    </button>
  );
}

type SaveResult = { error?: string; action?: { id: string } };

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function displayWallTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return value;
  const instant = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
    ),
  );
  return instant.toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AnnualRoadmap({
  profileId,
  timezone,
  year,
  currentMonth,
  initialPlans,
  initialSelectedId,
  editable,
  exportable,
}: {
  profileId: string;
  timezone: string;
  year: number;
  currentMonth: number;
  initialPlans: RoadmapPlan[];
  initialSelectedId?: string;
  editable: boolean;
  exportable: boolean;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [selected, setSelected] = useState<RoadmapPlan | undefined>(() =>
    initialPlans.find((plan) => plan.id === initialSelectedId),
  );
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [exportIds, setExportIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const exportChoices = plans.flatMap((plan) => {
    const entity = (() => {
      if (plan.persisted) return { kind: "planned", id: plan.id } as const;
      if (plan.status === "medical" && plan.recommendationId !== null) {
        return { kind: "recommendation", id: plan.recommendationId } as const;
      }
      if (plan.status === "reminder" && plan.id.startsWith("reminder-")) {
        return { kind: "reminder", id: plan.id.slice("reminder-".length) } as const;
      }
      if (plan.status === "maintenance" && plan.id.startsWith("maintenance-")) {
        return { kind: "maintenance", id: plan.id.slice("maintenance-".length) } as const;
      }
      return null;
    })();
    return entity === null
      ? []
      : [{ key: `${entity.kind}:${entity.id}`, title: plan.title, timing: plan.timing }];
  });
  const exportHref = `/api/profiles/${profileId}/calendar.ics?${exportIds
    .map((id) => `item=${encodeURIComponent(id)}`)
    .join("&")}`;

  function toggleExport(id: string) {
    setExportIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  }

  function openPlan(plan: RoadmapPlan) {
    setError(undefined);
    setSelected(plan);
  }

  function closePlan() {
    if (busy) return;
    setError(undefined);
    setSelected(undefined);
  }

  async function savePlan(formData: FormData) {
    if (selected === undefined || !editable || !isRoadmapItemPlannable(selected)) return;
    const month = Number(formData.get("plannedMonth"));
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      setError("Choose a valid planned month.");
      return;
    }

    setBusy(true);
    setError(undefined);
    const startRaw = String(formData.get("appointmentStart") ?? "");
    const endRaw = String(formData.get("appointmentEnd") ?? "");
    const location = optionalText(formData.get("location"));
    const notes = optionalText(formData.get("notes"));
    const reminderRaw = String(formData.get("reminderDaysBefore") ?? "");
    const reminderDaysBefore = reminderRaw === "" ? null : Number(reminderRaw);
    const payload = {
      recommendationInstanceId: selected.recommendationId,
      serviceId: selected.serviceId,
      title: selected.title,
      plannedMonth: `${year}-${String(month + 1).padStart(2, "0")}-01`,
      appointmentStart: startRaw === "" ? null : startRaw,
      appointmentEnd: endRaw === "" ? null : endRaw,
      reminderDaysBefore,
      location,
      notes,
    };
    const endpoint = selected.persisted
      ? `/api/profiles/${profileId}/planned-actions/${selected.id}`
      : `/api/profiles/${profileId}/planned-actions`;

    try {
      const response = await fetch(endpoint, {
        method: selected.persisted ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as SaveResult;
      if (!response.ok || result.action === undefined) {
        setError(result.error ?? "The plan could not be saved.");
        return;
      }

      const updated: RoadmapPlan = {
        ...selected,
        id: result.action.id,
        month,
        bucket: null,
        status: startRaw === "" ? "planned" : "appointment",
        timing:
          startRaw === ""
            ? `Planned for ${months[month]} ${year}`
            : `${displayWallTime(startRaw)} (${timezone})`,
        persisted: true,
        startDate: startRaw === "" ? null : startRaw.slice(0, 10),
        endDate: endRaw === "" ? null : endRaw.slice(0, 10),
        appointmentStartLocal: startRaw === "" ? null : startRaw,
        appointmentEndLocal: endRaw === "" ? null : endRaw,
        reminderDaysBefore,
        location,
        notes,
        detailHref: null,
      };
      setPlans((items) => [
        updated,
        ...items.filter(
          (item) =>
            item.id !== selected.id &&
            (selected.recommendationId === null ||
              item.recommendationId !== selected.recommendationId),
        ),
      ]);
      setSelected(undefined);
    } catch {
      setError("The plan could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPlan() {
    if (
      selected === undefined ||
      !selected.persisted ||
      !editable ||
      !isRoadmapItemPlannable(selected)
    )
      return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/profiles/${profileId}/planned-actions/${selected.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("The plan could not be cancelled.");
        return;
      }
      setPlans((items) => items.filter(({ id }) => id !== selected.id));
      setSelected(undefined);
    } catch {
      setError("The plan could not be cancelled. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const bucketPlans: Record<RoadmapBucket, RoadmapPlan[]> = {
    anytime: plans.filter((plan) => plan.month === null && plan.bucket === "anytime"),
    confirmation: plans.filter((plan) => plan.month === null && plan.bucket === "confirmation"),
    future: plans.filter((plan) => plan.month === null && plan.bucket === "future"),
  };
  const sortedPlans = plans.toSorted((left, right) => {
    const leftDate =
      left.startDate ?? `${year}-${String((left.month ?? 12) + 1).padStart(2, "0")}-32`;
    const rightDate =
      right.startDate ?? `${year}-${String((right.month ?? 12) + 1).padStart(2, "0")}-32`;
    const dateDifference = leftDate.localeCompare(rightDate);
    return dateDifference === 0 ? left.title.localeCompare(right.title) : dateDifference;
  });
  const selectedMonthItems = sortedPlans.filter((plan) =>
    roadmapItemAppearsInMonth(plan, selectedMonth),
  );
  const floatingMonthItems = selectedMonthItems.filter(
    (plan) => roadmapDayInMonth(plan, year, selectedMonth) === null,
  );
  const firstWeekday = new Date(Date.UTC(year, selectedMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, selectedMonth + 1, 0)).getUTCDate();

  return (
    <Tabs defaultValue="year">
      {exportable && exportChoices.length > 0 ? (
        <Card className="mb-5">
          <CardContent>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                  Calendar export
                </p>
                <h2 className="font-editorial mt-2 text-2xl font-semibold">Choose roadmap items</h2>
                <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
                  Export only the medical timing, plans, and appointments you choose. Titles and
                  descriptions stay neutral and omit health details.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExportIds(exportChoices.map(({ key }) => key))}
                  disabled={exportIds.length === exportChoices.length}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExportIds([])}
                  disabled={exportIds.length === 0}
                >
                  Clear
                </Button>
                {exportIds.length === 0 ? (
                  <Button type="button" variant="secondary" size="sm" disabled>
                    <Download aria-hidden="true" /> Export selected
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" asChild>
                    <Link prefetch={false} href={exportHref}>
                      <Download aria-hidden="true" /> Export selected ({exportIds.length})
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <fieldset className="mt-5 grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Roadmap items to export</legend>
              {exportChoices.map((choice) => (
                <label
                  key={choice.key}
                  className="border-line bg-surface-muted/35 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${choice.title} for calendar export`}
                    checked={exportIds.includes(choice.key)}
                    onChange={() => toggleExport(choice.key)}
                    className="accent-brand mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    <span className="block font-semibold">{choice.title}</span>
                    <span className="text-ink-soft mt-1 block">{choice.timing}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      ) : null}
      <TabsList aria-label="Calendar view">
        <TabsTrigger value="month">Month</TabsTrigger>
        <TabsTrigger value="agenda">Agenda</TabsTrigger>
        <TabsTrigger value="year">Year</TabsTrigger>
      </TabsList>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Calendar item legend">
        {(
          Object.entries(statusMetadata) as Array<
            [RoadmapItemStatus, (typeof statusMetadata)[RoadmapItemStatus]]
          >
        ).map(([status, metadata]) => {
          const Icon = metadata.icon;
          return (
            <span
              key={status}
              className={`inline-flex min-h-8 items-center gap-1.5 border px-2.5 text-xs font-semibold ${metadata.className}`}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {metadata.label}
            </span>
          );
        })}
      </div>
      <TabsContent value="month" className="space-y-5">
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                  Month view
                </p>
                <h2 className="font-editorial text-3xl font-semibold" aria-live="polite">
                  {longMonths[selectedMonth]} {year}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Previous month"
                  disabled={selectedMonth === 0}
                  onClick={() => setSelectedMonth((month) => Math.max(0, month - 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Next month"
                  disabled={selectedMonth === 11}
                  onClick={() => setSelectedMonth((month) => Math.min(11, month + 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
            <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
              Tab to any item to review it. Items without an exact day stay in the month-wide
              section instead of being assigned a made-up date.
            </p>
            <div className="mt-5 overflow-x-auto pb-2">
              <div className="min-w-[48rem]">
                <div className="grid grid-cols-7 gap-1" aria-hidden="true">
                  {weekdays.map((weekday) => (
                    <div
                      key={weekday}
                      className="text-ink-soft px-2 py-1 text-xs font-bold tracking-wider uppercase"
                    >
                      {weekday}
                    </div>
                  ))}
                </div>
                <div
                  className="mt-1 grid grid-cols-7 gap-1"
                  aria-label={`${longMonths[selectedMonth]} ${year} calendar grid`}
                >
                  {Array.from({ length: firstWeekday }, (_, index) => (
                    <div key={`leading-${index}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const dayItems = selectedMonthItems.filter(
                      (plan) => roadmapDayInMonth(plan, year, selectedMonth) === day,
                    );
                    const dateKey = `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${String(
                      day,
                    ).padStart(2, "0")}`;
                    return (
                      <section
                        key={day}
                        aria-label={`${longMonths[selectedMonth]} ${day}, ${year}`}
                        className="border-line bg-surface-muted/30 min-h-32 rounded-lg border p-1.5"
                      >
                        <time dateTime={dateKey} className="block px-1 text-xs font-bold">
                          {day}
                        </time>
                        <div className="mt-1 space-y-1.5">
                          {dayItems.map((plan) => (
                            <RoadmapItemButton
                              key={plan.id}
                              plan={plan}
                              onSelect={openPlan}
                              compact
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Badge tone="cool">Month-wide timing</Badge>
            <h2 className="font-editorial mt-3 text-2xl font-semibold">
              Flexible or spanning {longMonths[selectedMonth]} items
            </h2>
            <p className="text-ink-soft mt-2 text-sm leading-6">
              These items belong in this month but do not have one exact day here. Medical ranges
              remain ranges; planned months remain planning choices.
            </p>
            {floatingMonthItems.length === 0 ? (
              <p className="text-ink-soft mt-5 text-sm">No month-wide items.</p>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {floatingMonthItems.map((plan) => (
                  <RoadmapItemButton key={plan.id} plan={plan} onSelect={openPlan} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="year" className="space-y-5">
        <Card>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {months.map((month, monthIndex) => (
                <section
                  key={month}
                  className="border-line bg-surface-muted/35 min-h-36 rounded-xl border p-3"
                  aria-labelledby={`month-${month}`}
                >
                  <h3 id={`month-${month}`} className="font-editorial text-lg font-semibold">
                    {month}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {plans
                      .filter((plan) => plan.month === monthIndex)
                      .map((plan) => (
                        <RoadmapItemButton key={plan.id} plan={plan} onSelect={openPlan} compact />
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              {
                id: "anytime" as const,
                title: "Anytime this year",
                description: "Flexible annual items without one source-backed month.",
                empty: "No flexible annual items.",
              },
              {
                id: "confirmation" as const,
                title: "Date needs confirmation",
                description: "Recorded history is not precise enough to place these items safely.",
                empty: "No dates need confirmation.",
              },
              {
                id: "future" as const,
                title: "Unscheduled future",
                description: "Future guidance without a month in this annual roadmap.",
                empty: "No unscheduled future items.",
              },
            ] satisfies Array<{
              id: RoadmapBucket;
              title: string;
              description: string;
              empty: string;
            }>
          ).map((bucket) => (
            <Card key={bucket.id}>
              <CardContent>
                <section aria-labelledby={`roadmap-${bucket.id}-heading`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge tone="cool">Medical timing</Badge>
                      <h2
                        id={`roadmap-${bucket.id}-heading`}
                        className="font-editorial mt-3 text-2xl font-semibold"
                      >
                        {bucket.title}
                      </h2>
                    </div>
                    <CalendarPlus aria-hidden="true" className="text-sky shrink-0" />
                  </div>
                  <p className="text-ink-soft mt-2 text-sm leading-6">{bucket.description}</p>
                  <div className="mt-5 space-y-2">
                    {bucketPlans[bucket.id].length === 0 ? (
                      <p className="text-ink-soft text-sm">{bucket.empty}</p>
                    ) : (
                      bucketPlans[bucket.id].map((plan) => (
                        <RoadmapItemButton key={plan.id} plan={plan} onSelect={openPlan} />
                      ))
                    )}
                  </div>
                </section>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="agenda">
        <Card>
          <CardContent>
            <h2 className="font-editorial text-2xl font-semibold">Agenda</h2>
            {plans.length === 0 ? (
              <p className="text-ink-soft mt-5 text-sm">
                There are no active recommendations or personal plans to display.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {sortedPlans.map((plan) => (
                  <RoadmapItemButton key={plan.id} plan={plan} onSelect={openPlan} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={selected !== undefined} onOpenChange={(open) => !open && closePlan()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected !== undefined && editable && isRoadmapItemPlannable(selected)
                ? "Plan"
                : "View"}{" "}
              {selected?.title}
            </DialogTitle>
            <DialogDescription>
              {selected !== undefined && isRoadmapItemPlannable(selected)
                ? "Planning helps organize the year. It never changes the guideline-derived due window."
                : "This calendar item is informational and cannot be turned into a plan here."}
            </DialogDescription>
          </DialogHeader>
          {error !== undefined ? (
            <Alert tone="error" title="Could not save">
              {error}
            </Alert>
          ) : null}
          {selected !== undefined && editable && isRoadmapItemPlannable(selected) ? (
            <form key={selected.id} action={savePlan} className="mt-6 space-y-5">
              <FormField id="plannedMonth" label="Planned month">
                <Select
                  id="plannedMonth"
                  name="plannedMonth"
                  defaultValue={selected.month ?? currentMonth}
                >
                  {months.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="appointmentStart"
                  label="Appointment start (optional)"
                  hint={`Enter the local time in ${timezone}.`}
                >
                  <Input
                    id="appointmentStart"
                    name="appointmentStart"
                    type="datetime-local"
                    defaultValue={selected.appointmentStartLocal ?? ""}
                  />
                </FormField>
                <FormField id="appointmentEnd" label="Appointment end (optional)">
                  <Input
                    id="appointmentEnd"
                    name="appointmentEnd"
                    type="datetime-local"
                    defaultValue={selected.appointmentEndLocal ?? ""}
                  />
                </FormField>
              </div>
              <FormField
                id="appointmentReminder"
                label="Appointment reminder (optional)"
                hint="This changes reminder delivery only, not the care-plan due date."
              >
                <Select
                  id="appointmentReminder"
                  name="reminderDaysBefore"
                  defaultValue={selected.reminderDaysBefore?.toString() ?? ""}
                >
                  <option value="">No appointment reminder</option>
                  <option value="0">At the appointment time</option>
                  <option value="1">1 day before</option>
                  <option value="3">3 days before</option>
                  <option value="7">1 week before</option>
                  <option value="14">2 weeks before</option>
                  <option value="30">30 days before</option>
                </Select>
              </FormField>
              <FormField id="location" label="Location (optional)">
                <Input id="location" name="location" defaultValue={selected.location ?? ""} />
              </FormField>
              <FormField id="notes" label="Private notes (optional)">
                <Textarea id="notes" name="notes" defaultValue={selected.notes ?? ""} />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closePlan} disabled={busy}>
                  <X aria-hidden="true" /> Close
                </Button>
                {selected.persisted ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void cancelPlan()}
                  >
                    Cancel plan
                  </Button>
                ) : null}
                <Button type="submit" disabled={busy}>
                  <CalendarPlus aria-hidden="true" /> {busy ? "Saving…" : "Save plan"}
                </Button>
              </DialogFooter>
            </form>
          ) : selected !== undefined ? (
            <div className="mt-6 space-y-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-soft">Timing</dt>
                  <dd className="mt-1 font-semibold">{selected.timing}</dd>
                </div>
                {selected.appointmentEndLocal !== null ? (
                  <div>
                    <dt className="text-ink-soft">Appointment ends</dt>
                    <dd className="mt-1 font-semibold">
                      {displayWallTime(selected.appointmentEndLocal)} ({timezone})
                    </dd>
                  </div>
                ) : null}
                {selected.location !== null ? (
                  <div>
                    <dt className="text-ink-soft">Location</dt>
                    <dd className="mt-1 font-semibold">{selected.location}</dd>
                  </div>
                ) : null}
                {selected.notes !== null ? (
                  <div className="sm:col-span-2">
                    <dt className="text-ink-soft">Private notes</dt>
                    <dd className="mt-1 whitespace-pre-wrap">{selected.notes}</dd>
                  </div>
                ) : null}
              </dl>
              {isRoadmapItemPlannable(selected) ? (
                <Alert tone="info" title="View-only access">
                  You can review this calendar, but you cannot change plans or appointments for this
                  profile.
                </Alert>
              ) : selected.status === "reminder" ? (
                <Alert tone="info" title="Reminder only">
                  This prompt does not change medical status or timing and cannot be planned from
                  the calendar.
                </Alert>
              ) : (
                <Alert tone="info" title="Personal cadence, not universal guidance">
                  This chosen maintenance date is not a guideline deadline and cannot be planned
                  from the calendar.
                </Alert>
              )}
              <DialogFooter>
                {selected.detailHref !== null ? (
                  <Button variant="secondary" asChild>
                    <Link href={selected.detailHref}>View related details</Link>
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={closePlan}>
                  <X aria-hidden="true" /> Close
                </Button>
              </DialogFooter>
            </div>
          ) : null}
          {selected?.persisted &&
          isRoadmapItemPlannable(selected) &&
          (exportable || selected.status === "appointment") ? (
            <div className="border-line mt-4 flex flex-wrap gap-2 border-t pt-4">
              {exportable ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link prefetch={false} href={`/api/planned-actions/${selected.id}/calendar.ics`}>
                    <Download aria-hidden="true" /> Calendar file
                  </Link>
                </Button>
              ) : null}
              {selected.status === "appointment" ? (
                <Badge tone="cool">
                  <MapPin aria-hidden="true" /> Appointment
                </Badge>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
