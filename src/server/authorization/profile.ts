import { NotFoundError } from "@/domain/shared/errors";
import { prisma } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import {
  canDeleteProfile,
  canEditProfile,
  canExportProfile,
  canManageProfileSharing,
  canViewProfile,
  profileCapabilities,
  type ProfileAuthorizationContext,
} from "./policy";
import { resolveActiveProfileId } from "./active-profile";

export type RequiredProfilePermission = "view" | "edit" | "manage" | "export" | "delete";

export async function requireProfileAccess(
  profileId: string,
  permission: RequiredProfilePermission = "view",
) {
  const session = await requireSession();
  const resolvedProfileId =
    profileId === "active" ? await resolveActiveProfileId(session.user.id) : profileId;
  if (resolvedProfileId === null) throw new NotFoundError();
  const profile = await prisma.profile.findFirst({
    where: { id: resolvedProfileId, deletedAt: null },
    include: {
      household: {
        include: {
          members: { where: { userId: session.user.id, removedAt: null }, take: 1 },
        },
      },
      accessGrants: { where: { userId: session.user.id }, take: 1 },
    },
  });
  if (profile === null) throw new NotFoundError();

  const membership = profile.household.members[0] ?? null;
  const grant = profile.accessGrants[0] ?? null;
  const context: ProfileAuthorizationContext = {
    userId: session.user.id,
    profile: {
      ownerUserId: profile.ownerUserId,
      createdByUserId: profile.createdByUserId,
      visibility: profile.visibility,
      claimedAt: profile.claimedAt,
      deletedAt: profile.deletedAt,
    },
    membership:
      membership === null ? null : { role: membership.role, removedAt: membership.removedAt },
    grant: grant === null ? null : { permission: grant.permission },
  };

  const allowed =
    permission === "view"
      ? canViewProfile(context)
      : permission === "edit"
        ? canEditProfile(context)
        : permission === "manage"
          ? canManageProfileSharing(context)
          : permission === "export"
            ? canExportProfile(context)
            : canDeleteProfile(context);
  if (!allowed) throw new NotFoundError();
  return { session, profile, capabilities: profileCapabilities(context) };
}
