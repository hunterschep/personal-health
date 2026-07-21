import { OnboardingWizard } from "@/components/profile/onboarding-wizard";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { readStoredOnboardingDraftData } from "@/server/profiles";

export default async function OnboardingPage() {
  const session = await requireSession();
  const draft = await prisma.onboardingDraft.findUnique({ where: { userId: session.user.id } });
  const storedData = readStoredOnboardingDraftData(draft?.dataJson);
  const initialState: Record<string, string | boolean> = {};
  if (storedData !== null && typeof storedData === "object" && !Array.isArray(storedData)) {
    for (const [key, value] of Object.entries(storedData)) {
      if (typeof value === "string" || typeof value === "boolean") initialState[key] = value;
    }
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Progressive setup"
        title="Build a useful plan in minutes"
        description="Only the information needed for high-impact preventive guidance appears. Optional and sensitive questions can be skipped."
      />
      <OnboardingWizard initialStep={draft?.step ?? 0} initialState={initialState} />
    </div>
  );
}
