import type { LucideIcon } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="bg-brand-soft text-brand-strong mb-4 grid size-12 place-items-center rounded-2xl">
        <Icon aria-hidden="true" />
      </div>
      <h2 className="font-editorial text-2xl font-semibold">{title}</h2>
      <p className="text-ink-soft mt-2 max-w-md text-sm leading-6">{description}</p>
      {actionLabel !== undefined && onAction !== undefined ? (
        <Button onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
