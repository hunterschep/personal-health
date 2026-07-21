import type { ProfilePermission, ProfileVisibility } from "@/generated/prisma/client";

export type ProfileAuthorizationContext = {
  userId: string;
  profile: {
    ownerUserId: string | null;
    createdByUserId: string;
    visibility: ProfileVisibility;
    claimedAt: Date | null;
    deletedAt: Date | null;
  };
  membership: { role: "owner" | "admin" | "member"; removedAt: Date | null } | null;
  grant: { permission: ProfilePermission } | null;
};

export type ProfileCapabilities = {
  canEdit: boolean;
  canManage: boolean;
  canExport: boolean;
  canDelete: boolean;
};

function activeMember(context: ProfileAuthorizationContext): boolean {
  return context.membership !== null && context.membership.removedAt === null;
}

function unclaimedOrganizer(context: ProfileAuthorizationContext): boolean {
  if (context.profile.claimedAt !== null || !activeMember(context)) return false;
  return context.profile.createdByUserId === context.userId || context.membership?.role === "owner";
}

export function canViewProfile(context: ProfileAuthorizationContext): boolean {
  if (context.profile.deletedAt !== null) return false;
  if (context.profile.ownerUserId === context.userId) return true;
  if (unclaimedOrganizer(context)) return true;
  if (context.grant !== null && activeMember(context)) return true;
  return context.profile.visibility === "household" && activeMember(context);
}

export function canEditProfile(context: ProfileAuthorizationContext): boolean {
  if (!canViewProfile(context)) return false;
  if (context.profile.ownerUserId === context.userId || unclaimedOrganizer(context)) return true;
  return context.grant?.permission === "edit" || context.grant?.permission === "manage";
}

export function canManageProfileSharing(context: ProfileAuthorizationContext): boolean {
  if (context.profile.deletedAt !== null) return false;
  if (context.profile.ownerUserId === context.userId || unclaimedOrganizer(context)) return true;
  return context.grant?.permission === "manage" && activeMember(context);
}

export function canExportProfile(context: ProfileAuthorizationContext): boolean {
  return canManageProfileSharing(context);
}

export function canDeleteProfile(context: ProfileAuthorizationContext): boolean {
  if (context.profile.deletedAt !== null) return false;
  return context.profile.ownerUserId === context.userId || unclaimedOrganizer(context);
}

export function profileCapabilities(context: ProfileAuthorizationContext): ProfileCapabilities {
  return {
    canEdit: canEditProfile(context),
    canManage: canManageProfileSharing(context),
    canExport: canExportProfile(context),
    canDelete: canDeleteProfile(context),
  };
}

export function canAccessDocument(context: ProfileAuthorizationContext): boolean {
  return canViewProfile(context);
}

export function canViewHouseholdActivity(context: ProfileAuthorizationContext): boolean {
  return activeMember(context) && canViewProfile(context);
}

export type ProfileResource =
  | "profile"
  | "care_event"
  | "medication"
  | "override"
  | "planned_action"
  | "reminder"
  | "document"
  | "export"
  | "invite"
  | "activity"
  | "source_admin_diagnostics";

export type ProfileResourceAction = "read" | "mutate";

/**
 * Central resource matrix for route-policy tests and new profile-scoped features.
 * Nested entities inherit the parent profile boundary; routes must still bind the
 * nested entity ID to the authorized profile in their database query.
 */
export function canAccessProfileResource(
  context: ProfileAuthorizationContext | null,
  resource: ProfileResource,
  action: ProfileResourceAction,
): boolean {
  if (context === null || resource === "source_admin_diagnostics") return false;
  if (resource === "export") return action === "read" && canExportProfile(context);
  if (resource === "invite") return canManageProfileSharing(context);
  if (resource === "activity") {
    return action === "read" && canViewHouseholdActivity(context);
  }
  if (resource === "document" && action === "read") return canAccessDocument(context);
  return action === "read" ? canViewProfile(context) : canEditProfile(context);
}
