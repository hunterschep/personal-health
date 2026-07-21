import type { LucideIcon } from "lucide-react";
import { CalendarDays, Check, GitCompareArrows } from "lucide-react";
import type { ReactNode } from "react";
import { EvidenceClassBadge, SourceBadge, type EvidenceClass } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  label = "Care-plan completion",
  size = 112,
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  const bounded = Math.min(Math.max(value, 0), 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - bounded / 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(bounded)}
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--surface-muted)"
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="font-editorial absolute text-2xl font-semibold">{Math.round(bounded)}%</span>
    </div>
  );
}

export function profileInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
  return initials.length === 0 ? "?" : initials;
}

export function ProfileAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${name || "Unnamed"} profile`}
      className={cn(
        "border-brand/20 bg-brand-soft text-brand-strong inline-grid shrink-0 place-items-center rounded-full border font-bold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-16 text-lg",
        className,
      )}
    >
      {profileInitials(name)}
    </span>
  );
}

export type TimelinePrimitiveItem = Readonly<{
  id: string;
  date: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: LucideIcon;
}>;

export function ResponsiveTimeline({
  items,
  label = "Timeline",
}: {
  items: readonly TimelinePrimitiveItem[];
  label?: string;
}) {
  return (
    <ol aria-label={label} className="border-line relative ml-4 border-l sm:ml-24">
      {items.map((item) => {
        const Icon = item.icon ?? Check;
        return (
          <li key={item.id} className="relative pb-8 pl-8 last:pb-0 sm:pl-10">
            <span className="border-surface bg-brand-soft text-brand absolute top-0 -left-[1.05rem] grid size-8 place-items-center rounded-full border-4">
              <Icon aria-hidden="true" className="size-3.5" />
            </span>
            <div className="sm:grid sm:grid-cols-[7rem_1fr] sm:gap-5">
              <time className="text-ink-soft mb-2 block text-xs font-semibold sm:-ml-[11.5rem] sm:pt-2 sm:text-right">
                {item.date}
              </time>
              <article className="border-line bg-surface rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.meta}
                </div>
                {item.description === undefined ? null : (
                  <div className="text-ink-soft mt-2 text-sm leading-6">{item.description}</div>
                )}
              </article>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type CalendarEvent = Readonly<{
  id: string;
  label: string;
  tone?: "brand" | "warm" | "cool" | "neutral";
}>;

export type CalendarDay = Readonly<{
  date: string;
  dayNumber: number;
  outsideMonth?: boolean;
  today?: boolean;
  events?: readonly CalendarEvent[];
}>;

const calendarEventTone = {
  brand: "border-brand/25 bg-brand-soft text-brand-strong",
  warm: "border-accent/25 bg-accent-soft text-ink",
  cool: "border-sky/25 bg-sky-soft text-ink",
  neutral: "border-line bg-surface-muted text-ink-soft",
} as const;

export function CalendarMonth({
  monthLabel,
  days,
  weekStartsOn = "Sunday",
}: {
  monthLabel: string;
  days: readonly CalendarDay[];
  weekStartsOn?: "Sunday" | "Monday";
}) {
  const sunday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdays = weekStartsOn === "Sunday" ? sunday : [...sunday.slice(1), sunday[0]];
  return (
    <section
      aria-label={monthLabel}
      className="border-line bg-surface overflow-hidden rounded-xl border"
    >
      <header className="border-line flex items-center gap-3 border-b px-4 py-3">
        <CalendarDays aria-hidden="true" className="text-brand size-5" />
        <h3 className="font-editorial text-xl font-semibold">{monthLabel}</h3>
      </header>
      <div className="overflow-x-auto">
        <div role="grid" aria-label={`${monthLabel} calendar`} className="min-w-[42rem]">
          <div role="row" className="bg-surface-muted grid grid-cols-7">
            {weekdays.map((weekday) => (
              <div
                key={weekday}
                role="columnheader"
                className="text-ink-soft px-2 py-2 text-center text-xs font-bold uppercase"
              >
                {weekday}
              </div>
            ))}
          </div>
          {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => (
            <div key={weekIndex} role="row" className="grid grid-cols-7">
              {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => (
                <div
                  key={day.date}
                  role="gridcell"
                  aria-current={day.today ? "date" : undefined}
                  className={cn(
                    "border-line min-h-28 border-t border-r p-2 last:border-r-0",
                    day.outsideMonth && "bg-surface-muted/40 text-ink-soft",
                  )}
                >
                  <time
                    dateTime={day.date}
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-sm font-semibold",
                      day.today && "bg-brand text-white",
                    )}
                  >
                    {day.dayNumber}
                  </time>
                  <ul className="mt-1.5 space-y-1">
                    {(day.events ?? []).map((event) => (
                      <li
                        key={event.id}
                        className={cn(
                          "truncate rounded-md border px-1.5 py-1 text-[0.68rem] font-semibold",
                          calendarEventTone[event.tone ?? "neutral"],
                        )}
                        title={event.label}
                      >
                        {event.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PrintOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("print-only", className)}>{children}</section>;
}

export type GuidelineVariant = Readonly<{
  id: string;
  source: string;
  title: string;
  timing: string;
  evidenceClass?: EvidenceClass;
  note?: string;
}>;

export function GuidelinesDifferPanel({
  variants,
  title = "Guidelines differ",
  description = "Reputable sources can recommend different timing. Compare them without treating one as a hidden default.",
}: {
  variants: readonly GuidelineVariant[];
  title?: string;
  description?: string;
}) {
  return (
    <section
      className="border-sky/30 bg-sky-soft/55 rounded-card border p-5 sm:p-6"
      aria-label={title}
    >
      <div className="flex gap-3">
        <span className="bg-surface text-sky grid size-10 shrink-0 place-items-center rounded-xl">
          <GitCompareArrows aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h3 className="font-editorial text-2xl font-semibold">{title}</h3>
          <p className="text-ink-soft mt-1 max-w-3xl text-sm leading-6">{description}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {variants.map((variant) => (
          <Card key={variant.id} className="bg-surface-raised">
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <SourceBadge>{variant.source}</SourceBadge>
                {variant.evidenceClass === undefined ? null : (
                  <EvidenceClassBadge evidenceClass={variant.evidenceClass} />
                )}
              </div>
              <h4 className="mt-4 font-semibold">{variant.title}</h4>
              <p className="text-ink mt-2 text-sm">{variant.timing}</p>
              {variant.note === undefined ? null : (
                <p className="text-ink-soft mt-2 text-xs leading-5">{variant.note}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
