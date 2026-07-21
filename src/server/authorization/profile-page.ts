import { withPageAuthorization } from "@/server/authorization/page-access";
import {
  requireProfileAccess,
  type RequiredProfilePermission,
} from "@/server/authorization/profile";

/**
 * Adapts profile authorization failures to App Router control flow.
 * Route handlers should keep using `requireProfileAccess` so API errors retain
 * their neutral JSON status codes.
 */
export async function requireProfilePageAccess(
  profileId: string,
  permission: RequiredProfilePermission = "view",
) {
  return withPageAuthorization(() => requireProfileAccess(profileId, permission));
}
