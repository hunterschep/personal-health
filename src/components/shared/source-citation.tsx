import { ExternalLink } from "lucide-react";

export function SourceCitation({
  organization,
  title,
  url,
  verifiedAt,
}: {
  organization: string;
  title: string;
  url: string;
  verifiedAt: string;
}) {
  return (
    <aside
      className="border-line bg-surface-muted/60 rounded-xl border p-4"
      aria-label="Guideline source"
    >
      <p className="text-ink-soft text-[0.7rem] font-bold tracking-[0.08em] uppercase">Source</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-brand-strong decoration-brand/30 hover:decoration-brand mt-1 inline-flex items-start gap-2 font-semibold underline underline-offset-4"
      >
        <span>
          {organization}: {title}
        </span>
        <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      </a>
      <p className="text-ink-soft mt-2 text-xs">Last verified {verifiedAt}</p>
    </aside>
  );
}
