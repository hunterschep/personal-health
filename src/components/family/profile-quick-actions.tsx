import { ClipboardList, History, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ProfileQuickActions({
  profileId,
  displayName,
  canEdit,
}: {
  profileId: string;
  displayName: string;
  canEdit: boolean;
}) {
  return (
    <nav aria-label={`Quick actions for ${displayName}`} className="mt-3 grid grid-cols-2 gap-2">
      <Button asChild size="sm" variant="ghost">
        <Link
          href={`/app/profile/${profileId}/care-plan`}
          aria-label={`View ${displayName}'s care plan`}
        >
          <ClipboardList aria-hidden="true" /> Care plan
        </Link>
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link
          href={`/app/profile/${profileId}/timeline`}
          aria-label={`View ${displayName}'s timeline`}
        >
          <History aria-hidden="true" /> Timeline
        </Link>
      </Button>
      {canEdit ? (
        <Button asChild size="sm" variant="ghost" className="col-span-2">
          <Link
            href={`/app/profile/${profileId}/records/new`}
            aria-label={`Add a record for ${displayName}`}
          >
            <Plus aria-hidden="true" /> Add record
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}
