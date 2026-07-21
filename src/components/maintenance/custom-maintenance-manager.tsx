"use client";

import {
  Bell,
  CalendarClock,
  ChevronDown,
  CircleSlash2,
  FlaskConical,
  LockKeyhole,
  Pencil,
  Plus,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { useState } from "react";

import type { CustomMaintenanceView } from "@/server/custom-maintenance";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import {
  MaintenanceEditor,
  type MaintenanceTemplateView,
  TemplateAdoptionDialog,
} from "./maintenance-editor";

const timingLabels: Record<CustomMaintenanceView["timingState"], string> = {
  disabled: "Disabled",
  cadence_needed: "Cadence not set",
  cadence_set: "Cadence selected",
  scheduled: "Planned",
  timing_review: "Timing needs review",
};

function displayDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MaintenanceCard({
  item,
  canEdit,
  onEdit,
  onDisable,
}: {
  item: CustomMaintenanceView;
  canEdit: boolean;
  onEdit: () => void;
  onDisable: () => void;
}) {
  const sourceTone =
    item.source === "clinician" ? "cool" : item.source === "personal" ? "brand" : "warm";
  return (
    <Card className={item.status === "disabled" ? "opacity-70" : "overflow-hidden"}>
      <CardContent className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sourceTone}>{item.sourceLabel}</Badge>
            <Badge tone={item.timingState === "timing_review" ? "warm" : "neutral"}>
              {timingLabels[item.timingState]}
            </Badge>
            {item.kind === "lab_bundle" ? <Badge tone="warm">Lab bundle</Badge> : null}
          </div>
          <p className="text-ink-soft mt-4 text-[0.68rem] font-bold tracking-[0.1em] uppercase">
            {item.category}
          </p>
          <h3 className="font-editorial mt-1 text-2xl font-semibold tracking-[-0.025em]">
            {item.title}
          </h3>
          {item.purpose !== null ? (
            <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">{item.purpose}</p>
          ) : null}

          {item.kind === "lab_bundle" ? (
            <div className="border-accent/25 bg-accent-soft mt-4 rounded-xl border p-4">
              <div className="flex gap-3">
                <FlaskConical aria-hidden="true" className="text-accent mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Personal lab plan</p>
                  <p className="text-ink-soft mt-1 text-xs leading-5">{item.warning}</p>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Lab entries">
                    {item.labEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="border-accent/20 bg-surface/65 rounded-full border px-3 py-1 text-xs font-medium"
                      >
                        {entry.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <dl className="text-ink-soft mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex gap-2">
              <CalendarClock aria-hidden="true" className="text-brand size-4 shrink-0" />
              <div>
                <dt className="text-ink font-semibold">Timing</dt>
                <dd className="mt-0.5">
                  {item.cadenceLabel ?? "No recurring cadence"}
                  {item.nextDate !== null ? ` · Next ${displayDate(item.nextDate)}` : ""}
                  {item.startDate !== null || item.stopDate !== null ? (
                    <span className="mt-1 block">
                      {item.startDate !== null
                        ? `Starts ${displayDate(item.startDate)}`
                        : "No start date"}
                      {item.stopDate !== null ? ` · Stops ${displayDate(item.stopDate)}` : ""}
                    </span>
                  ) : null}
                </dd>
              </div>
            </div>
            <div className="flex gap-2">
              {item.source === "clinician" ? (
                <Stethoscope aria-hidden="true" className="text-sky size-4 shrink-0" />
              ) : (
                <Sparkles aria-hidden="true" className="text-brand size-4 shrink-0" />
              )}
              <div>
                <dt className="text-ink font-semibold">Attribution</dt>
                <dd className="mt-0.5">
                  {[item.clinicianName, item.practiceName].filter(Boolean).join(" · ") ||
                    item.sourceLabel}
                </dd>
              </div>
            </div>
            <div className="flex gap-2">
              {item.visibility === "owner_only" ? (
                <LockKeyhole aria-hidden="true" className="text-brand size-4 shrink-0" />
              ) : (
                <Users aria-hidden="true" className="text-brand size-4 shrink-0" />
              )}
              <div>
                <dt className="text-ink font-semibold">Visibility</dt>
                <dd className="mt-0.5">{item.visibilityLabel}</dd>
              </div>
            </div>
            {item.reminderEnabled ? (
              <div className="flex gap-2">
                <Bell aria-hidden="true" className="text-accent size-4 shrink-0" />
                <div>
                  <dt className="text-ink font-semibold">Reminder</dt>
                  <dd className="mt-0.5">{item.reminderDaysBefore} days before the next date</dd>
                </div>
              </div>
            ) : null}
          </dl>
          {item.notes !== null ? (
            <p className="border-line text-ink-soft mt-4 border-t pt-4 text-sm leading-6">
              {item.notes}
            </p>
          ) : null}
        </div>

        {canEdit && item.status !== "disabled" ? (
          <div className="flex gap-2 lg:flex-col">
            <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDisable}>
              <CircleSlash2 aria-hidden="true" /> Disable
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CustomMaintenanceManager({
  profileId,
  profileName,
  initialItems,
  initialTemplates,
  canEdit,
  canUseOwnerOnly,
}: {
  profileId: string;
  profileName: string;
  initialItems: CustomMaintenanceView[];
  initialTemplates: MaintenanceTemplateView[];
  canEdit: boolean;
  canUseOwnerOnly: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [templates, setTemplates] = useState(initialTemplates);
  const [editor, setEditor] = useState<{
    kind: "routine" | "lab_bundle";
    item: CustomMaintenanceView | null;
  } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MaintenanceTemplateView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeItems = items.filter((item) => item.status !== "disabled");
  const disabledItems = items.filter((item) => item.status === "disabled");

  function saveItem(item: CustomMaintenanceView) {
    setItems((current) => {
      const exists = current.some(({ id }) => id === item.id);
      return exists
        ? current.map((candidate) => (candidate.id === item.id ? item : candidate))
        : [item, ...current];
    });
    setError(null);
  }

  async function disableItem(item: CustomMaintenanceView) {
    if (
      !globalThis.confirm(
        `Disable “${item.title}”? You can restore a template later by reviewing its choice.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/profiles/${profileId}/custom-maintenance/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result: unknown = await response.json();
        setError(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "The item could not be disabled.",
        );
        return;
      }
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                status: "disabled",
                timingState: "disabled",
                reminderEnabled: false,
                reminderDaysBefore: null,
              }
            : candidate,
        ),
      );
      if (item.templateServiceId !== null) {
        setTemplates((current) =>
          current.map((template) =>
            template.id === item.templateServiceId
              ? { ...template, adoption: { id: item.id, status: "disabled" } }
              : template,
          ),
        );
      }
    } catch {
      setError("The item could not be disabled. Check your connection and try again.");
    }
  }

  function openItemEditor(item: CustomMaintenanceView) {
    if (item.templateServiceId !== null) {
      const template = templates.find(({ id }) => id === item.templateServiceId);
      if (template !== undefined) {
        setSelectedTemplate(template);
        return;
      }
    }
    setEditor({ kind: item.kind, item });
  }

  function saveTemplateItem(item: CustomMaintenanceView) {
    saveItem(item);
    setTemplates((current) =>
      current.map((template) =>
        template.id === item.templateServiceId
          ? { ...template, adoption: { id: item.id, status: item.status } }
          : template,
      ),
    );
  }

  return (
    <div className="space-y-9">
      <Alert tone="info" title="Personal planning stays separate from general guidance">
        These items reflect a personal choice, a clinician instruction, or an editable CareCadence
        template. They are never presented as federal recommendations.
      </Alert>

      {!canEdit ? (
        <Alert tone="warning" title="View-only access">
          You can read shared custom plans for {profileName}, but only someone with edit access can
          change them.
        </Alert>
      ) : null}

      {error !== null ? (
        <Alert tone="error" title="Could not complete the change">
          {error}
        </Alert>
      ) : null}

      <section aria-labelledby="personal-plans-heading">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
              Chosen for this profile
            </p>
            <h2 id="personal-plans-heading" className="font-editorial mt-1 text-3xl font-semibold">
              Personal plans
            </h2>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditor({ kind: "lab_bundle", item: null })}
              >
                <FlaskConical aria-hidden="true" /> Add lab bundle
              </Button>
              <Button type="button" onClick={() => setEditor({ kind: "routine", item: null })}>
                <Plus aria-hidden="true" /> Add custom item
              </Button>
            </div>
          ) : null}
        </div>

        {activeItems.length === 0 ? (
          canEdit ? (
            <EmptyState
              icon={Sparkles}
              title="No personal plans yet"
              description="Add a custom routine, record a clinician instruction, or choose how to use one of the editable templates below."
              actionLabel="Add custom item"
              onAction={() => setEditor({ kind: "routine", item: null })}
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No personal plans yet"
              description="No shared custom routines or clinician instructions are available for this profile."
            />
          )
        ) : (
          <div className="space-y-3">
            {activeItems.map((item) => (
              <MaintenanceCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                onEdit={() => openItemEditor(item)}
                onDisable={() => void disableItem(item)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="templates-heading">
        <div className="mb-4 max-w-2xl">
          <p className="text-accent text-xs font-bold tracking-[0.1em] uppercase">
            Optional starting points
          </p>
          <h2 id="templates-heading" className="font-editorial mt-1 text-3xl font-semibold">
            Maintenance templates
          </h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            A template has no due state by default. Choose a cadence, keep it as an ask-clinician
            prompt, or disable it.
          </p>
        </div>
        {initialTemplates.length === 0 ? (
          <Alert tone="info" title="Templates are not available yet">
            The app catalog can be seeded without changing any existing personal plan.
          </Alert>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="group hover:border-brand/40 h-full transition hover:-translate-y-0.5"
              >
                <CardContent className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Badge
                      tone={
                        template.adoption === null
                          ? "neutral"
                          : template.adoption.status === "active"
                            ? "brand"
                            : "warm"
                      }
                    >
                      {template.adoption === null
                        ? "Not added"
                        : template.adoption.status === "ask_clinician"
                          ? "Ask clinician"
                          : template.adoption.status}
                    </Badge>
                    {template.kind === "lab_bundle" ? (
                      <FlaskConical aria-hidden="true" className="text-accent size-5" />
                    ) : (
                      <Sparkles aria-hidden="true" className="text-brand size-5" />
                    )}
                  </div>
                  <p className="text-ink-soft mt-4 text-[0.68rem] font-bold tracking-[0.08em] uppercase">
                    {template.category}
                  </p>
                  <h3 className="font-editorial mt-1 text-xl font-semibold">{template.name}</h3>
                  <p className="text-ink-soft mt-2 flex-1 text-sm leading-6">{template.purpose}</p>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-4 -ml-3 self-start"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      {template.adoption === null ? "Choose how to use" : "Review choice"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {disabledItems.length > 0 ? (
        <details className="border-line bg-surface/60 rounded-2xl border p-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
            Disabled personal plans ({disabledItems.length})
            <ChevronDown aria-hidden="true" className="size-4" />
          </summary>
          <div className="mt-3 space-y-3">
            {disabledItems.map((item) => (
              <MaintenanceCard
                key={item.id}
                item={item}
                canEdit={false}
                onEdit={() => undefined}
                onDisable={() => undefined}
              />
            ))}
          </div>
        </details>
      ) : null}

      {editor !== null ? (
        <MaintenanceEditor
          key={`${editor.item?.id ?? "new"}-${editor.kind}`}
          profileId={profileId}
          kind={editor.kind}
          item={editor.item}
          open
          canUseOwnerOnly={canUseOwnerOnly}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
          onSaved={saveItem}
        />
      ) : null}

      {selectedTemplate !== null ? (
        <TemplateAdoptionDialog
          key={`${selectedTemplate.id}-${selectedTemplate.adoption?.status ?? "new"}`}
          profileId={profileId}
          template={selectedTemplate}
          item={
            items.find(({ templateServiceId }) => templateServiceId === selectedTemplate.id) ?? null
          }
          open
          canUseOwnerOnly={canUseOwnerOnly}
          onOpenChange={(open) => {
            if (!open) setSelectedTemplate(null);
          }}
          onSaved={saveTemplateItem}
        />
      ) : null}
    </div>
  );
}
