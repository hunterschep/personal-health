import type { ReactNode } from "react";

import {
  omittedVisitPrepItemCount,
  omittedVisitPrepQuestionCount,
  omittedVisitPrepTotal,
  visibleVisitPrepItems,
  visibleVisitPrepQuestions,
} from "./visit-prep-utils";
import type {
  VisitPrepData,
  VisitPrepMode,
  VisitPrepSectionKey,
  VisitPrepSectionSelection,
} from "./visit-prep-types";

function AgendaSection({
  title,
  items,
  empty,
  mode,
  section,
  wide = false,
}: {
  title: string;
  items: string[];
  empty: string;
  mode: VisitPrepMode;
  section: VisitPrepSectionKey;
  wide?: boolean;
}) {
  const visibleItems = visibleVisitPrepItems(items, mode, section);
  const omitted = omittedVisitPrepItemCount(items.length, mode, section);
  return (
    <section className={`visit-prep-section ${wide ? "sm:col-span-2" : ""}`}>
      <h3 className="font-editorial text-xl font-semibold">{title}</h3>
      {visibleItems.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#59645f]">{empty}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
          {visibleItems.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
      {omitted > 0 ? (
        <p className="no-print mt-2 text-xs font-semibold text-[#59645f]">
          {omitted} more {omitted === 1 ? "item" : "items"} available in extended mode
        </p>
      ) : null}
    </section>
  );
}

function AppointmentSection({ data, mode }: { data: VisitPrepData; mode: VisitPrepMode }) {
  const appointments = visibleVisitPrepItems(data.appointments, mode, "appointments");
  const omitted = omittedVisitPrepItemCount(data.appointments.length, mode, "appointments");
  return (
    <section className="visit-prep-section border-brand/20 rounded-2xl border bg-[#f3f7f3] p-4 sm:col-span-2">
      <h3 className="font-editorial text-xl font-semibold">Upcoming appointment</h3>
      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-[#59645f]">No exact appointment is scheduled.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {appointments.map((appointment, index) => (
            <div key={`${index}-${appointment.title}-${appointment.timing}`}>
              <p className="text-sm font-semibold">{appointment.title}</p>
              <p className="mt-1 text-sm leading-6">{appointment.timing}</p>
              <p className="mt-0.5 text-xs text-[#59645f]">
                {appointment.location ?? "Location not recorded"} · {appointment.timezone}
              </p>
            </div>
          ))}
        </div>
      )}
      {omitted > 0 ? (
        <p className="no-print mt-2 text-xs font-semibold text-[#59645f]">
          {omitted} more scheduled {omitted === 1 ? "appointment" : "appointments"} in extended mode
        </p>
      ) : null}
    </section>
  );
}

function If({ when, children }: { when: boolean; children: ReactNode }) {
  return when ? children : null;
}

export function VisitPrepSheet({
  data,
  mode,
  sections,
  questions,
}: {
  data: VisitPrepData;
  mode: VisitPrepMode;
  sections: VisitPrepSectionSelection;
  questions: string[];
}) {
  const visibleQuestions = visibleVisitPrepQuestions(questions, mode);
  const omittedQuestions = omittedVisitPrepQuestionCount(questions.length, mode);
  const omittedTotal = omittedVisitPrepTotal(data, mode, sections, questions.length);

  return (
    <article
      className="visit-prep-sheet rounded-card border-line border bg-white p-6 text-[#18201d] shadow-[0_18px_50px_rgb(var(--shadow)/0.08)] sm:p-10 print:border-0 print:p-0 print:shadow-none"
      aria-label="Doctor visit agenda preview"
      data-mode={mode}
    >
      <header className="flex items-start justify-between gap-5 border-b border-[#d7d9d4] pb-5">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-[#49645d] uppercase">
            CareCadence visit agenda
          </p>
          <h2 className="font-editorial mt-2 text-3xl font-semibold">{data.profileName}</h2>
          <p className="mt-1 text-sm text-[#59645f]">
            Age {data.age} · generated {data.generatedOn} · {mode} format
          </p>
        </div>
        <span className="font-editorial grid size-11 shrink-0 place-items-center rounded-full bg-[#dce9df] text-xl font-semibold text-[#17483c]">
          C
        </span>
      </header>

      <div className="visit-prep-grid mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <If when={sections.appointments}>
          <AppointmentSection data={data} mode={mode} />
        </If>
        <If when={sections.medications}>
          <AgendaSection
            title="Current medications"
            items={data.medications}
            empty="No active medications recorded."
            mode={mode}
            section="medications"
          />
        </If>
        <If when={sections.conditions}>
          <AgendaSection
            title="Major conditions"
            items={data.conditions}
            empty="No active conditions recorded."
            mode={mode}
            section="conditions"
          />
        </If>
        <If when={sections.attention}>
          <AgendaSection
            title="Due now or soon"
            items={data.attention}
            empty="No due items in the current plan."
            mode={mode}
            section="attention"
          />
        </If>
        <If when={sections.thisYear}>
          <AgendaSection
            title="Due this year"
            items={data.thisYear}
            empty="No later-this-year items in the current plan."
            mode={mode}
            section="thisYear"
          />
        </If>
        <If when={sections.unknown}>
          <AgendaSection
            title="History to clarify"
            items={data.unknown}
            empty="No history prompts in the current plan."
            mode={mode}
            section="unknown"
          />
        </If>
        <If when={sections.discussion}>
          <AgendaSection
            title="Shared decisions"
            items={data.discussion}
            empty="No shared-decision items in the current plan."
            mode={mode}
            section="discussion"
          />
        </If>
        <If when={sections.clinician}>
          <AgendaSection
            title="Personal clinician plan"
            items={data.clinician}
            empty="No active personal clinician instructions."
            mode={mode}
            section="clinician"
          />
        </If>
        <If when={sections.recentEvents}>
          <AgendaSection
            title="Recent abnormal or inconclusive records"
            items={data.recentEvents}
            empty="No abnormal or inconclusive results recorded in the recent window."
            mode={mode}
            section="recentEvents"
            wide
          />
        </If>
        <If when={sections.personalNotes}>
          <AgendaSection
            title="Personal notes"
            items={data.personalNotes}
            empty="No personal notes added."
            mode={mode}
            section="personalNotes"
            wide
          />
        </If>
        <section className="visit-prep-section sm:col-span-2">
          <h3 className="font-editorial text-xl font-semibold">Questions to bring</h3>
          {visibleQuestions.length === 0 ? (
            <p className="mt-2 text-sm text-[#59645f]">No questions added.</p>
          ) : (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6">
              {visibleQuestions.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ol>
          )}
          {omittedQuestions > 0 ? (
            <p className="no-print mt-2 text-xs font-semibold text-[#59645f]">
              {omittedQuestions} more {omittedQuestions === 1 ? "question" : "questions"} available
              in extended mode
            </p>
          ) : null}
        </section>
      </div>

      <footer className="mt-8 border-t border-[#d7d9d4] pt-4 text-[0.65rem] leading-4 text-[#59645f]">
        {omittedTotal > 0 ? (
          <p className="mb-1 font-semibold">
            Concise format omits {omittedTotal} additional {omittedTotal === 1 ? "item" : "items"}.
            Use Extended for the complete agenda.
          </p>
        ) : null}
        {data.sourceLinks.length > 0 ? (
          <div className="mb-2">
            <p className="font-semibold">Reviewed sources</p>
            {data.sourceLinks.map((source) => (
              <p key={source.url} className="break-all">
                {source.label}: {source.url}
              </p>
            ))}
          </div>
        ) : null}
        Generated by CareCadence. This agenda organizes preventive-care information and personal
        records. It does not diagnose conditions, interpret results, replace medical advice, or
        determine whether a specific test is safe or appropriate for you.
      </footer>
    </article>
  );
}
