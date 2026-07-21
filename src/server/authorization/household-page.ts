import {
  requireHouseholdAccess,
  type RequiredHouseholdPermission,
} from "@/server/authorization/household";
import { withPageAuthorization } from "@/server/authorization/page-access";

export async function requireHouseholdPageAccess(
  householdId: string,
  permission: RequiredHouseholdPermission = "view",
) {
  return withPageAuthorization(() => requireHouseholdAccess(householdId, permission));
}
