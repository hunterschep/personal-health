import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div>
        {eyebrow !== undefined ? (
          <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-editorial mt-1 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {title}
        </h1>
        {description !== undefined ? (
          <p className="text-ink-soft mt-2 max-w-2xl leading-7">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
