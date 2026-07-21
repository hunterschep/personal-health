import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Optional companion panel for pages that keep a selected item beside the main content. */
export function RightDetailPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label={title}
      className={cn(
        "border-line bg-surface rounded-card self-start border p-5 shadow-[0_18px_50px_rgb(var(--shadow)/0.08)] xl:sticky xl:top-24 xl:p-6",
        className,
      )}
    >
      <h2 className="font-editorial text-2xl font-semibold">{title}</h2>
      {description === undefined ? null : (
        <p className="text-ink-soft mt-1 text-sm leading-6">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </aside>
  );
}
