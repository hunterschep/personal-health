function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

export function LastVerifiedLabel({ verifiedAt }: { verifiedAt: string }) {
  return (
    <span className="text-ink-soft text-sm">
      Last verified <time dateTime={verifiedAt}>{displayDate(verifiedAt)}</time>
    </span>
  );
}

export function SourceDate({ value }: { value: string }) {
  return <time dateTime={value}>{displayDate(value)}</time>;
}
