import { ExternalLink } from "lucide-react";
import type { PublicSourceMetadata } from "@/server/sources/types";
import { LastVerifiedLabel, SourceDate } from "./date-label";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export function SourceMetadataPanel({ source }: { source: PublicSourceMetadata }) {
  return (
    <section
      className="border-line bg-surface rounded-2xl border p-5"
      aria-labelledby="source-meta"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ink-soft text-sm font-semibold">{source.organization}</p>
          <h2 id="source-meta" className="text-ink mt-1 text-lg font-semibold">
            {source.title}
          </h2>
        </div>
        <span className="bg-surface-muted text-ink-soft rounded-full px-3 py-1 text-xs font-semibold">
          {label(source.evidenceClass)}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-soft">Jurisdiction</dt>
          <dd className="text-ink mt-1 font-medium">United States</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Source version</dt>
          <dd className="text-ink mt-1 font-medium">{source.sourceVersion}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Published</dt>
          <dd className="text-ink mt-1 font-medium">
            {source.publishedAt === null ? "Not stated" : <SourceDate value={source.publishedAt} />}
          </dd>
        </div>
        <div>
          <dt className="text-ink-soft">Effective</dt>
          <dd className="text-ink mt-1 font-medium">
            {source.effectiveAt === null ? "Not stated" : <SourceDate value={source.effectiveAt} />}
          </dd>
        </div>
      </dl>

      <div className="border-line mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <LastVerifiedLabel verifiedAt={source.lastVerifiedAt} />
        <a
          href={source.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand-strong inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
        >
          Open official source
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
