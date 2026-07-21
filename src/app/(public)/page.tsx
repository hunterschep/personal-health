import {
  ArrowRight,
  CalendarRange,
  Check,
  Fingerprint,
  GitCompareArrows,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/shell/public-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { routes } from "@/config";

const planItems = [
  { label: "Colorectal screening", detail: "Choose a method", tone: "warm" as const },
  { label: "Blood pressure review", detail: "Recommended this year", tone: "cool" as const },
  { label: "Flu vaccine", detail: "Plan for autumn", tone: "brand" as const },
];

const principles = [
  {
    icon: Fingerprint,
    title: "Personal without guessing",
    text: "Age, relevant anatomy, history, and risk context shape a plan. Approximate dates stay approximate.",
  },
  {
    icon: GitCompareArrows,
    title: "Guidelines stay visible",
    text: "Reputable sources can disagree. Compare each variant, its timing, and its evidence directly.",
  },
  {
    icon: LockKeyhole,
    title: "Adult privacy by default",
    text: "A household helps coordinate care without granting automatic access to another adult’s profile.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ accountDeleted?: string; cleanupPending?: string }>;
}) {
  const status = await searchParams;
  return (
    <div className="min-h-screen overflow-hidden">
      <PublicHeader />
      <main id="main-content">
        {status.accountDeleted === "1" ? (
          <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8 lg:px-10">
            <Alert tone="success" title="Account deleted">
              Your account can no longer be used to sign in.
              {status.cleanupPending === "1"
                ? " A private document cleanup retry is queued for the self-hosted operator."
                : " Private document deletion completed."}
            </Alert>
          </div>
        ) : null}
        <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pt-14 pb-24 sm:px-8 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-10 lg:pt-24 lg:pb-32">
          <div className="animate-rise max-w-2xl">
            <Badge tone="brand" className="mb-6">
              <Sparkles aria-hidden="true" /> Source-backed preventive care
            </Badge>
            <h1 className="font-editorial text-[clamp(3.4rem,8vw,7.7rem)] leading-[0.82] font-medium tracking-[-0.055em] text-balance">
              Know what comes <span className="text-brand italic">next.</span>
            </h1>
            <p className="text-ink-soft mt-8 max-w-xl text-lg leading-8 text-balance sm:text-xl">
              CareCadence turns preventive-care guidance, personal history, and clinician
              instructions into one calm, understandable plan for every adult in your household.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href={routes.register}>
                  Build your care plan <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href={routes.signIn}>Sign in</Link>
              </Button>
            </div>
            <p className="text-ink-soft mt-5 flex items-center gap-2 text-sm">
              <ShieldCheck aria-hidden="true" className="text-brand size-4" /> Self-hostable. No
              paid service required.
            </p>
          </div>

          <div className="animate-rise relative mx-auto w-full max-w-xl [animation-delay:140ms]">
            <div
              aria-hidden="true"
              className="border-brand/15 absolute -top-20 -right-20 size-64 rounded-full border"
            />
            <div
              aria-hidden="true"
              className="border-brand/20 absolute -top-10 -right-10 size-44 rounded-full border"
            />
            <Card className="border-line-strong bg-surface-raised/90 relative overflow-hidden p-3 shadow-[0_32px_90px_rgb(var(--shadow)/0.16)] sm:p-4">
              <div className="border-line bg-surface rounded-[calc(var(--radius)-0.2rem)] border p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-ink-soft text-xs font-bold tracking-[0.12em] uppercase">
                      This year
                    </p>
                    <h2 className="font-editorial mt-2 text-3xl font-semibold tracking-[-0.03em]">
                      A steadier care rhythm
                    </h2>
                  </div>
                  <div className="border-brand-soft text-brand-strong grid size-16 shrink-0 place-items-center rounded-full border-[5px]">
                    <CalendarRange aria-hidden="true" className="size-6" />
                  </div>
                </div>
                <div className="mt-7 space-y-3">
                  {planItems.map((item, index) => (
                    <div
                      key={item.label}
                      className="border-line bg-surface-raised hover:border-line-strong flex items-center gap-3 rounded-2xl border p-3.5 transition hover:-translate-y-0.5"
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                          item.tone === "warm"
                            ? "bg-accent-soft text-accent"
                            : item.tone === "cool"
                              ? "bg-sky-soft text-sky"
                              : "bg-brand-soft text-brand"
                        }`}
                      >
                        {index === 0 ? (
                          <MessageCircleMore aria-hidden="true" className="size-4" />
                        ) : index === 1 ? (
                          <CalendarRange aria-hidden="true" className="size-4" />
                        ) : (
                          <Check aria-hidden="true" className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.label}</span>
                        <span className="text-ink-soft block text-xs">{item.detail}</span>
                      </span>
                      <ArrowRight aria-hidden="true" className="text-ink-soft size-4" />
                    </div>
                  ))}
                </div>
                <div className="bg-brand-soft mt-5 flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                  <span className="text-brand-strong font-semibold">Next milestone</span>
                  <span className="text-ink-soft">Age 60 · 2 years away</span>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="border-line bg-surface/70 border-y">
          <div className="divide-line mx-auto grid max-w-7xl divide-y px-5 sm:px-8 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:px-10">
            {principles.map(({ icon: Icon, title, text }) => (
              <article key={title} className="py-10 lg:px-9 lg:first:pl-0 lg:last:pr-0">
                <Icon aria-hidden="true" className="text-brand size-6" />
                <h2 className="font-editorial mt-5 text-2xl font-semibold tracking-[-0.02em]">
                  {title}
                </h2>
                <p className="text-ink-soft mt-3 max-w-sm text-sm leading-6">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-8 sm:py-32">
          <p className="text-brand text-xs font-bold tracking-[0.15em] uppercase">
            Clarity, not certainty theater
          </p>
          <h2 className="font-editorial mt-5 text-4xl font-medium tracking-[-0.035em] text-balance sm:text-6xl">
            Every recommendation shows its work.
          </h2>
          <p className="text-ink-soft mx-auto mt-6 max-w-2xl text-lg leading-8">
            See which facts apply, how the due window was calculated, which methods count, where the
            guidance came from, and when a clinician’s personal plan should take precedence.
          </p>
          <Button asChild size="lg" className="mt-9">
            <Link href={routes.register}>
              Start privately <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="border-line text-ink-soft border-t px-5 py-8 text-center text-xs leading-5 sm:px-8">
        <p>
          CareCadence organizes preventive-care information and personal records. It does not
          diagnose conditions, replace medical advice, or determine whether a specific test is safe
          or appropriate for you.
        </p>
      </footer>
    </div>
  );
}
