import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CareEventForm } from "@/components/records/care-event-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

export default async function NewRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { profileId } = await params;
  const { service } = await searchParams;
  const { profile } = await requireProfilePageAccess(profileId, "edit");
  const catalog = await prisma.serviceCatalog.findMany({
    where: { active: true },
    include: { methods: { where: { active: true }, orderBy: { name: "asc" } } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={`/app/profile/${profile.id}/records`}>
          <ArrowLeft aria-hidden="true" /> Back to records
        </Link>
      </Button>
      <PageHeader
        eyebrow="Care history"
        title="Add a care record"
        description="Record only the precision you know. Saving recalculates relevant recommendations immediately."
      />
      <Card>
        <CardContent>
          <CareEventForm
            profileId={profile.id}
            catalog={catalog.map((entry) => ({
              slug: entry.slug,
              name: entry.name,
              category: entry.category,
              methods: entry.methods.map((method) => ({ slug: method.slug, name: method.name })),
            }))}
            {...(service === undefined ? {} : { initialService: service })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
