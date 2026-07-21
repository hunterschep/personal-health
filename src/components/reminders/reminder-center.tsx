"use client";

import {
  Bell,
  CalendarClock,
  Check,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReminderSection = "today" | "upcoming" | "snoozed" | "sent" | "dismissed";
type Reminder = {
  id: string;
  title: string;
  detail: string;
  remindAt: string;
  channel: "in_app" | "email";
  status: "pending" | "sent" | "dismissed" | "cancelled";
  snoozedUntil: string | null;
  section: ReminderSection;
};

type ReminderResponse = {
  editable: boolean;
  smtpAvailable: boolean;
  smtpStatus: "disabled" | "checking" | "ready" | "unavailable";
  reminders: Reminder[];
};

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : "The reminder request could not be completed.";
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReminderCenter() {
  const [data, setData] = useState<ReminderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/profiles/active/reminders", {
      signal: signal ?? null,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(await responseError(response));
    return (await response.json()) as ReminderResponse;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Reminders are unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  async function refresh() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/profiles/active/reminders/generate", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(await responseError(response));
      setData(await load());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reminders could not be refreshed.");
    } finally {
      setGenerating(false);
    }
  }

  async function update(
    reminder: Reminder,
    action: "snooze" | "cancel_snooze" | "dismiss" | "restore",
  ) {
    setBusyId(reminder.id);
    setError(null);
    try {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 7);
      const response = await fetch(`/api/profiles/active/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(
          action === "snooze" ? { action, snoozeUntil: snoozeUntil.toISOString() } : { action },
        ),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setData(await load());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The reminder could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  function list(section: ReminderSection) {
    const items = data?.reminders.filter((item) => item.section === section) ?? [];
    if (items.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center">
            <Check aria-hidden="true" className="text-brand mx-auto size-6" />
            <h2 className="font-editorial mt-3 text-2xl font-semibold">Nothing here</h2>
            <p className="text-ink-soft mt-2 text-sm">This reminder section is clear.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-3">
        {items.map((reminder) => (
          <Card key={reminder.id}>
            <CardContent className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex gap-4">
                <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-xl">
                  {reminder.channel === "email" ? (
                    <Mail aria-hidden="true" className="size-4" />
                  ) : (
                    <Bell aria-hidden="true" className="size-4" />
                  )}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{reminder.title}</h3>
                    <Badge tone={reminder.channel === "email" ? "cool" : "warm"}>
                      {reminder.channel === "email" ? "Email" : "In app"}
                    </Badge>
                  </div>
                  <p className="text-ink-soft mt-2 text-sm leading-6">{reminder.detail}</p>
                  <p className="text-ink-soft mt-2 text-xs font-semibold">
                    {section === "snoozed" ? "Snoozed until " : ""}
                    {dateLabel(reminder.remindAt)}
                  </p>
                </div>
              </div>
              {section === "sent" ? (
                <Badge tone="neutral">Sent</Badge>
              ) : !data?.editable ? (
                <Badge tone="neutral">
                  {section === "dismissed"
                    ? "Dismissed"
                    : section === "snoozed"
                      ? "Snoozed"
                      : "Pending"}
                </Badge>
              ) : section === "dismissed" ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busyId === reminder.id}
                  onClick={() => void update(reminder, "restore")}
                >
                  {busyId === reminder.id ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <RotateCcw aria-hidden="true" />
                  )}{" "}
                  Restore
                </Button>
              ) : section === "snoozed" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busyId === reminder.id}
                    onClick={() => void update(reminder, "cancel_snooze")}
                  >
                    {busyId === reminder.id ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                    ) : (
                      <RotateCcw aria-hidden="true" />
                    )}{" "}
                    Cancel snooze
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === reminder.id}
                    onClick={() => void update(reminder, "dismiss")}
                  >
                    <MoreHorizontal aria-hidden="true" /> Dismiss
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busyId === reminder.id}
                    onClick={() => void update(reminder, "snooze")}
                  >
                    {busyId === reminder.id ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                    ) : (
                      <CalendarClock aria-hidden="true" />
                    )}{" "}
                    Snooze 7 days
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === reminder.id}
                    onClick={() => void update(reminder, "dismiss")}
                  >
                    <MoreHorizontal aria-hidden="true" /> Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-10 text-sm font-semibold" role="status">
          <LoaderCircle aria-hidden="true" className="text-brand size-5 animate-spin" /> Loading
          reminders
        </CardContent>
      </Card>
    );
  }
  if (data === null) {
    return (
      <Alert tone="warning" title="Reminders are unavailable">
        {error ?? "Create or select an adult profile, then try again."}
      </Alert>
    );
  }

  const count = (section: ReminderSection) =>
    data.reminders.filter((item) => item.section === section).length;
  return (
    <div className="space-y-5">
      {error === null ? null : (
        <Alert tone="warning" title="Reminder update failed">
          {error}
        </Alert>
      )}
      {!data.editable ? (
        <Alert tone="info" title="View-only access">
          You can review reminders for this profile, but only someone with edit access can refresh,
          snooze, dismiss, or restore them.
        </Alert>
      ) : null}
      <Card className="border-line-strong bg-surface-muted/45">
        <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex gap-3">
            <Mail aria-hidden="true" className="text-ink-soft mt-1 size-5" />
            <div>
              <h2 className="font-semibold">
                {data.smtpStatus === "unavailable"
                  ? "Email delivery verification failed"
                  : data.smtpStatus === "checking"
                    ? "Email delivery is being checked"
                    : data.smtpAvailable
                      ? "Email delivery is available"
                      : "Email delivery is not configured"}
              </h2>
              <p className="text-ink-soft mt-1 text-sm">
                {data.smtpStatus === "unavailable"
                  ? "Check the server SMTP configuration. In-app reminders continue to work normally."
                  : data.smtpStatus === "checking"
                    ? "Startup verification is in progress. In-app reminders continue to work normally."
                    : "In-app reminders remain available. Email subjects never include service or diagnosis details."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/app/settings#reminders-heading">Reminder settings</Link>
            </Button>
            {data.editable ? (
              <Button type="button" size="sm" disabled={generating} onClick={() => void refresh()}>
                {generating ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                {generating ? "Refreshing…" : "Refresh reminders"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="today">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="today">Today ({count("today")})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({count("upcoming")})</TabsTrigger>
          <TabsTrigger value="snoozed">Snoozed ({count("snoozed")})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({count("sent")})</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed ({count("dismissed")})</TabsTrigger>
        </TabsList>
        <TabsContent value="today">{list("today")}</TabsContent>
        <TabsContent value="upcoming">{list("upcoming")}</TabsContent>
        <TabsContent value="snoozed">{list("snoozed")}</TabsContent>
        <TabsContent value="sent">{list("sent")}</TabsContent>
        <TabsContent value="dismissed">{list("dismissed")}</TabsContent>
      </Tabs>
    </div>
  );
}
