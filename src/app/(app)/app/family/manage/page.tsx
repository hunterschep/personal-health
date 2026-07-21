import { HouseholdManager } from "@/components/family/household-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireHouseholdPageAccess } from "@/server/authorization/household-page";
import { prisma } from "@/server/db/client";

export default async function ManageHouseholdPage() {
  const { session, membership, household } = await requireHouseholdPageAccess("active", "view");
  const members = await prisma.householdMember.findMany({
    where: { householdId: household.id, removedAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        eyebrow="Household administration"
        title={household.name}
        description="Manage roles and timezone without changing any adult profile’s independent privacy setting."
      />
      <HouseholdManager
        householdId={household.id}
        initialName={household.name}
        initialTimezone={household.timezone}
        currentRole={membership.role}
        initialMembers={members.map((member) => ({
          id: member.id,
          userId: member.userId,
          name: member.user.name ?? member.user.email,
          email: member.user.email,
          role: member.role,
          isCurrent: member.userId === session.user.id,
        }))}
      />
    </div>
  );
}
