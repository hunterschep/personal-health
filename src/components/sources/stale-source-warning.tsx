import { CalendarClock } from "lucide-react";

export function StaleSourceWarning() {
  return (
    <aside className="border-line bg-surface-muted flex gap-3 rounded-xl border p-4" role="status">
      <CalendarClock aria-hidden="true" className="text-ink-soft mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-ink text-sm font-semibold">Source review due</p>
        <p className="text-ink-soft mt-1 text-sm">
          This rule is based on the last reviewed source version shown below. A source review is
          due.
        </p>
      </div>
    </aside>
  );
}
