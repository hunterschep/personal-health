import { Clock3, CloudOff } from "lucide-react";

function displayTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CachedContentNotice({
  fetchedAt,
  fallback,
  stale,
}: {
  fetchedAt: string;
  fallback: boolean;
  stale: boolean;
}) {
  const Icon = fallback ? CloudOff : Clock3;
  return (
    <aside className="border-line bg-surface-muted flex gap-3 rounded-xl border p-4" role="status">
      <Icon aria-hidden="true" className="text-ink-soft mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-ink text-sm font-semibold">
          {fallback ? "Showing the last available source copy" : "Showing a cached source copy"}
        </p>
        <p className="text-ink-soft mt-1 text-sm">
          Fetched <time dateTime={fetchedAt}>{displayTimestamp(fetchedAt)}</time>
          {stale ? ". This cached copy is past its refresh window." : "."}
        </p>
      </div>
    </aside>
  );
}
