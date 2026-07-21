import { cva, type VariantProps } from "class-variance-authority";
import { BookOpenText, FlaskConical } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold tracking-[0.05em] uppercase",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-muted text-ink-soft",
        brand: "border-brand/20 bg-brand-soft text-brand-strong",
        warm: "border-accent/20 bg-accent-soft text-ink",
        cool: "border-sky/20 bg-sky-soft text-ink",
        critical: "border-rose/20 bg-rose-soft text-rose",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export type EvidenceClass =
  | "uspstf_final"
  | "uspstf_draft"
  | "cdc_acip_operational"
  | "cdc_public_health_recommendation"
  | "hrsa_supported_guideline"
  | "federal_consumer_content"
  | "specialty_society_guideline"
  | "app_authored_template"
  | "personal_clinician_instruction";

const evidenceLabels: Record<EvidenceClass, string> = {
  uspstf_final: "USPSTF final",
  uspstf_draft: "USPSTF draft",
  cdc_acip_operational: "CDC / ACIP",
  cdc_public_health_recommendation: "CDC public health",
  hrsa_supported_guideline: "HRSA supported",
  federal_consumer_content: "Federal consumer content",
  specialty_society_guideline: "Specialty society",
  app_authored_template: "CareCadence template",
  personal_clinician_instruction: "Personal clinician instruction",
};

export function EvidenceClassBadge({ evidenceClass }: { evidenceClass: EvidenceClass }) {
  return (
    <Badge tone="cool">
      <FlaskConical aria-hidden="true" />
      {evidenceLabels[evidenceClass]}
    </Badge>
  );
}

export function SourceBadge({ children }: { children: string }) {
  return (
    <Badge tone="neutral">
      <BookOpenText aria-hidden="true" />
      {children}
    </Badge>
  );
}
