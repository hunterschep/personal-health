import { addCalendarDays, addCalendarMonths } from "@/domain/dates";

export type CalendarEvent = {
  uid: string;
  sequence: number;
  title: string;
  description: string;
  start: { kind: "date"; value: string } | { kind: "instant"; value: Date; timezone: string };
  end: { kind: "date"; value: string } | { kind: "instant"; value: Date; timezone: string } | null;
  location: string | null;
  url: string | null;
};

function text(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function dateValue(value: string): string {
  return value.replaceAll("-", "");
}

function instantValue(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new RangeError("Calendar event time is not valid.");
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function foldIcsLine(line: string): string {
  const output: string[] = [];
  let segment = "";
  let bytes = 0;
  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    const limit = output.length === 0 ? 75 : 74;
    if (bytes + characterBytes > limit) {
      output.push(segment);
      segment = ` ${character}`;
      bytes = 1 + characterBytes;
    } else {
      segment += character;
      bytes += characterBytes;
    }
  }
  output.push(segment);
  return output.join("\r\n");
}

function dateLines(event: CalendarEvent): string[] {
  if (event.start.kind === "date") {
    const end =
      event.end?.kind === "date" ? event.end.value : addCalendarDays(event.start.value, 1);
    return [
      `DTSTART;VALUE=DATE:${dateValue(event.start.value)}`,
      `DTEND;VALUE=DATE:${dateValue(end)}`,
    ];
  }
  return [
    `DTSTART:${instantValue(event.start.value)}`,
    ...(event.end?.kind === "instant" ? [`DTEND:${instantValue(event.end.value)}`] : []),
    `X-CARECADENCE-TIMEZONE:${text(event.start.timezone)}`,
  ];
}

export function createIcs(events: readonly CalendarEvent[], generatedAt = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//CareCadence//Care Planning Calendar 1.0//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${text(event.uid)}`,
      `DTSTAMP:${instantValue(generatedAt)}`,
      `SEQUENCE:${Math.max(0, Math.trunc(event.sequence))}`,
      ...dateLines(event),
      `SUMMARY:${text(event.title)}`,
      `DESCRIPTION:${text(event.description)}`,
      ...(event.location === null ? [] : [`LOCATION:${text(event.location)}`]),
      ...(event.url === null ? [] : [`URL:${event.url}`]),
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function plannedMonthRange(value: Date): { start: string; end: string } {
  const start = `${value.toISOString().slice(0, 7)}-01`;
  return { start, end: addCalendarMonths(start, 1) };
}

export function nextDay(value: Date): string {
  return addCalendarDays(value.toISOString().slice(0, 10), 1);
}
