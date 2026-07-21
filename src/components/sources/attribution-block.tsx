import type { SourceAttribution } from "@/server/sources/types";

export function AttributionBlock({ attribution }: { attribution: SourceAttribution }) {
  if (!attribution.required) return null;

  return (
    <footer
      className="border-line bg-surface-muted mt-5 rounded-xl border p-4"
      aria-label="Source attribution"
    >
      {attribution.logoUrl !== null && attribution.destinationUrl !== null ? (
        <a
          href={attribution.destinationUrl}
          title="MyHealthfinder"
          target="_blank"
          rel="noreferrer"
          className="inline-flex"
        >
          {/* The provider's terms require this exact remotely hosted attribution mark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attribution.logoUrl}
            alt="MyHealthfinder"
            width={180}
            height={48}
            className="h-10 w-auto"
          />
        </a>
      ) : null}
      {attribution.text === null ? null : (
        <p className="text-ink-soft mt-2 max-w-3xl text-sm">{attribution.text}</p>
      )}
      {attribution.contentMustRemainUnaltered ? (
        <p className="text-ink-soft mt-1 text-xs">Source-supplied text is shown separately.</p>
      ) : null}
    </footer>
  );
}
