"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

type Preferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  unknownHistoryPrompts: boolean;
  quietDays: number[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  dueSoonWindowDays: number;
  householdActivityDetail: boolean;
  timezone: string;
  digestMode: "individual" | "daily" | "weekly";
};

type PreferenceResponse = {
  editable: boolean;
  smtpAvailable: boolean;
  smtpStatus: "disabled" | "checking" | "ready" | "unavailable";
  emailOwnerControlled: true;
  canManageEmail: boolean;
  preferences: Preferences;
};

const booleanRows = [
  {
    key: "inAppEnabled",
    title: "In-app reminders",
    description: "Available without an external delivery service.",
  },
  {
    key: "emailEnabled",
    title: "Email reminders",
    description: "Neutral-subject messages sent only to the profile owner.",
  },
  {
    key: "unknownHistoryPrompts",
    title: "Unknown-history prompts",
    description: "A modest follow-up after onboarding, without aggressive repetition.",
  },
  {
    key: "householdActivityDetail",
    title: "Detailed household activity",
    description: "Shared profiles may show service names; sensitive activity stays private.",
  },
] as const;

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : "The reminder preference could not be saved.";
}

export function ReminderPreferences() {
  const [configuration, setConfiguration] = useState<PreferenceResponse | null>(null);
  const [values, setValues] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profiles/active/reminder-preferences", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return (await response.json()) as PreferenceResponse;
      })
      .then((data) => {
        setConfiguration(data);
        setValues(data.preferences);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "Reminder preferences are unavailable.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setValues((current) => (current === null ? current : { ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function toggleQuietDay(day: number) {
    if (values === null) return;
    update(
      "quietDays",
      values.quietDays.includes(day)
        ? values.quietDays.filter((candidate) => candidate !== day)
        : [...values.quietDays, day].sort(),
    );
  }

  async function save() {
    if (values === null) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/profiles/active/reminder-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as PreferenceResponse;
      setConfiguration(data);
      setValues(data.preferences);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Reminder preferences could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-10 text-sm font-semibold" role="status">
          <LoaderCircle aria-hidden="true" className="text-brand size-5 animate-spin" /> Loading
          reminder preferences
        </CardContent>
      </Card>
    );
  }
  if (values === null || configuration === null) {
    return (
      <Alert tone="warning" title="Reminder preferences are unavailable">
        {error ?? "Create or select an adult profile, then try again."}
      </Alert>
    );
  }

  const emailUnavailable = !configuration.smtpAvailable || !configuration.canManageEmail;
  const emailMessage =
    configuration.smtpStatus === "unavailable"
      ? "SMTP is configured, but startup verification failed. Check the server configuration. In-app reminders continue to work normally."
      : configuration.smtpStatus === "checking"
        ? "SMTP startup verification is in progress. In-app reminders continue to work normally."
        : !configuration.smtpAvailable
          ? "SMTP is not configured. In-app reminders continue to work normally."
          : !configuration.canManageEmail
            ? "Only the adult profile owner can enable email delivery."
            : "SMTP is available. Email subjects stay neutral and the profile owner controls delivery.";

  return (
    <div className="space-y-5">
      <Alert
        tone={emailUnavailable ? "info" : "success"}
        title={
          configuration.smtpStatus === "checking"
            ? "Email delivery is being checked"
            : emailUnavailable
              ? "Email delivery is limited"
              : "Email delivery is available"
        }
      >
        {emailMessage}
      </Alert>
      {!configuration.editable ? (
        <Alert tone="info" title="View-only access">
          You can review reminder settings for this profile, but edit access is required to change
          them.
        </Alert>
      ) : null}
      {error === null ? null : (
        <Alert tone="warning" title="Preferences were not saved">
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <h3 className="font-editorial text-2xl font-semibold">Channels and privacy</h3>
          <div className="border-line mt-5 divide-y">
            {booleanRows.map(({ key, title, description }) => {
              const disabled =
                saving || !configuration.editable || (key === "emailEnabled" && emailUnavailable);
              return (
                <div key={key} className="flex min-h-20 items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-ink-soft mt-1 text-sm leading-6">{description}</p>
                  </div>
                  <Switch
                    aria-label={title}
                    checked={values[key]}
                    disabled={disabled}
                    onCheckedChange={(checked) => update(key, checked)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="font-editorial text-2xl font-semibold">Timing</h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reminder-timezone">Timezone</Label>
              <Input
                id="reminder-timezone"
                list="carecadence-timezones"
                value={values.timezone}
                disabled={saving || !configuration.editable}
                onChange={(event) => update("timezone", event.target.value)}
              />
              <datalist id="carecadence-timezones">
                <option value="America/New_York" />
                <option value="America/Chicago" />
                <option value="America/Denver" />
                <option value="America/Los_Angeles" />
                <option value="America/Phoenix" />
                <option value="Pacific/Honolulu" />
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-soon-window">Planning window</Label>
              <Select
                id="due-soon-window"
                value={String(values.dueSoonWindowDays)}
                disabled={saving || !configuration.editable}
                onChange={(event) => update("dueSoonWindowDays", Number(event.target.value))}
              >
                {[30, 60, 90, 180, 365].map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="digest-mode">Email grouping</Label>
              <Select
                id="digest-mode"
                value={values.digestMode}
                disabled={saving || !configuration.editable || !values.emailEnabled}
                onChange={(event) =>
                  update("digestMode", event.target.value as Preferences["digestMode"])
                }
              >
                <option value="individual">Individual reminders</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Quiet hours start</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={values.quietHoursStart ?? ""}
                  disabled={saving || !configuration.editable}
                  onChange={(event) => update("quietHoursStart", event.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">Quiet hours end</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={values.quietHoursEnd ?? ""}
                  disabled={saving || !configuration.editable}
                  onChange={(event) => update("quietHoursEnd", event.target.value || null)}
                />
              </div>
            </div>
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">Quiet days</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {weekdays.map((day, index) => {
                const checked = values.quietDays.includes(index);
                return (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={checked ? "primary" : "secondary"}
                    aria-pressed={checked}
                    disabled={saving || !configuration.editable}
                    onClick={() => toggleQuietDay(index)}
                  >
                    {day.slice(0, 3)}
                  </Button>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {configuration.editable ? (
        <div className="flex items-center justify-end gap-3">
          {saved ? (
            <span
              role="status"
              className="text-brand flex items-center gap-2 text-sm font-semibold"
            >
              <Check aria-hidden="true" className="size-4" /> Preferences saved
            </span>
          ) : null}
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
