import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-card
      className={cn(
        "rounded-card border-line bg-surface/95 border shadow-[0_18px_50px_rgb(var(--shadow)/0.08)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 p-5 pb-2 sm:p-6 sm:pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-editorial text-xl font-semibold tracking-[-0.02em]", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-ink-soft text-sm leading-6", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-4 sm:p-6 sm:pt-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3 p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent>
        <div className="text-brand flex min-h-6 items-center justify-between gap-3">
          <p className="text-ink-soft text-xs font-bold tracking-[0.08em] uppercase">{label}</p>
          {icon}
        </div>
        <p className="font-editorial mt-3 text-4xl font-semibold tracking-[-0.03em]">{value}</p>
        {detail === undefined ? null : (
          <div className="text-ink-soft mt-2 text-sm leading-6">{detail}</div>
        )}
      </CardContent>
    </Card>
  );
}
