import type { ReactNode } from "react";
import type { SourceAttribution } from "@/server/sources/types";
import { sanitizeExternalHtml } from "@/server/sources/sanitize";
import { AttributionBlock } from "./attribution-block";

export function MyHealthfinderContent({
  title,
  html,
  lastUpdated,
  attribution,
}: {
  title: string;
  html: string;
  lastUpdated: string;
  attribution: SourceAttribution;
}) {
  const sanitizedHtml = sanitizeExternalHtml(html);
  return (
    <section
      className="border-line bg-surface rounded-2xl border p-5"
      aria-labelledby="source-content-title"
      data-content-boundary="source-supplied"
    >
      <p className="text-ink-soft text-xs font-bold tracking-[0.08em] uppercase">
        Source-supplied content
      </p>
      <h2 id="source-content-title" className="text-ink mt-1 text-xl font-semibold">
        {title}
      </h2>
      <p className="text-ink-soft mt-1 text-sm">
        Content last updated <time dateTime={lastUpdated}>{lastUpdated}</time>
      </p>
      <div
        className="prose prose-slate mt-5 max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      <AttributionBlock attribution={attribution} />
    </section>
  );
}

export function AppAuthoredSourceSummary({ children }: { children: ReactNode }) {
  return (
    <section
      className="border-line bg-surface-muted rounded-xl border p-4"
      data-content-boundary="app-authored"
    >
      <p className="text-ink-soft text-xs font-bold tracking-[0.08em] uppercase">
        CareCadence summary
      </p>
      <div className="text-ink mt-2 text-sm leading-6">{children}</div>
    </section>
  );
}
