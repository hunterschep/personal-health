import { NotFoundError } from "@/domain/shared/errors";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { resolveActiveProfileId } from "./active-profile";

export type RequiredHouseholdPermission = "view" | "manage" | "owner";

export async function requireHouseholdAccess(
  householdId: string,
  permission: RequiredHouseholdPermission = "view",
) {
  const session = await requireSession();
  let resolvedId: string | undefined = householdId;
  if (householdId === "active") {
    const activeProfileId = await resolveActiveProfileId(session.user.id);
    const selectedMembership =
      activeProfileId === null
        ? null
        : await prisma.householdMember.findFirst({
            where: {
              userId: session.user.id,
              removedAt: null,
              household: {
                deletedAt: null,
                profiles: { some: { id: activeProfileId, deletedAt: null } },
              },
            },
            select: { householdId: true },
          });
    const fallbackMembership =
      selectedMembership ??
      (await prisma.householdMember.findFirst({
        where: { userId: session.user.id, removedAt: null, household: { deletedAt: null } },
        orderBy: { joinedAt: "asc" },
        select: { householdId: true },
      }));
    resolvedId = fallbackMembership?.householdId;
  }
  if (resolvedId === undefined) throw new NotFoundError();
  const membership = await prisma.householdMember.findFirst({
    where: {
      householdId: resolvedId,
      userId: session.user.id,
      removedAt: null,
      household: { deletedAt: null },
    },
    include: { household: true },
  });
  if (membership === null) throw new NotFoundError();
  if (permission === "manage" && membership.role === "member") throw new NotFoundError();
  if (permission === "owner" && membership.role !== "owner") throw new NotFoundError();
  return { session, membership, household: membership.household };
}
