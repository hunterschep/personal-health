import { FlaskConical } from "lucide-react";

export function DemoModeBanner() {
  return (
    <aside
      className="border-accent/30 bg-accent-soft text-ink mb-6 flex gap-3 rounded-2xl border px-4 py-3"
      aria-label="Synthetic demo data"
    >
      <FlaskConical aria-hidden="true" className="text-accent mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-sm font-bold">Synthetic demo household</p>
        <p className="text-ink-soft mt-0.5 text-xs leading-5">
          Every name, record, note, clinician reference, and document in this account is fictional.
          Do not enter real health information here.
        </p>
      </div>
    </aside>
  );
}
