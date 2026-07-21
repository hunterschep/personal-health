import Link from "next/link";
import { routes } from "@/config";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href={routes.home} className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="border-brand/25 bg-brand-soft text-brand-strong grid size-9 place-items-center rounded-full border shadow-sm">
        <span aria-hidden="true" className="font-editorial text-xl font-semibold italic">
          C
        </span>
      </span>
      {!compact ? (
        <span className="font-editorial text-xl font-semibold tracking-[-0.025em]">
          CareCadence
        </span>
      ) : null}
      <span className="sr-only">CareCadence home</span>
    </Link>
  );
}
