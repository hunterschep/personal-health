import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "error";

const toneStyles: Record<AlertTone, string> = {
  info: "border-sky/30 bg-sky-soft",
  success: "border-brand/30 bg-brand-soft",
  warning: "border-accent/30 bg-accent-soft",
  error: "border-rose/30 bg-rose-soft",
};

export function Alert({
  className,
  tone = "info",
  title,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; title: string }) {
  const Icon = tone === "success" ? CircleCheck : tone === "info" ? Info : CircleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-4", toneStyles[tone], className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-ink font-semibold">{title}</p>
        <div className="text-ink-soft mt-1 text-sm leading-6">{children}</div>
      </div>
    </div>
  );
}
