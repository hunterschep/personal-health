import type { ReactNode } from "react";

export function GuidelineComparisonMetadataRow({
  label,
  values,
}: {
  label: string;
  values: readonly ReactNode[];
}) {
  return (
    <div className="border-line grid gap-2 border-t py-3 md:grid-cols-[12rem_1fr]">
      <dt className="text-ink-soft text-sm font-semibold">{label}</dt>
      <div className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col">
        {values.map((value, index) => (
          <dd key={index} className="text-ink text-sm">
            {value ?? "Not stated"}
          </dd>
        ))}
      </div>
    </div>
  );
}
