import { ExternalLink } from "lucide-react";
import type { PublicSourceMetadata } from "@/server/sources/types";
import { LastVerifiedLabel } from "./date-label";

export function SourceCitation({ source }: { source: PublicSourceMetadata }) {
  return (
    <aside className="border-line bg-surface-muted/60 rounded-xl border p-4" aria-label="Source">
      <p className="text-ink-soft text-[0.7rem] font-bold tracking-[0.08em] uppercase">Source</p>
      <a
        href={source.canonicalUrl}
        target="_blank"
        rel="noreferrer"
        className="text-brand-strong decoration-brand/30 hover:decoration-brand mt-1 inline-flex items-start gap-2 font-semibold underline underline-offset-4"
      >
        <span>
          {source.organization}: {source.title}
        </span>
        <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      </a>
      <div className="mt-2">
        <LastVerifiedLabel verifiedAt={source.lastVerifiedAt} />
      </div>
    </aside>
  );
}
