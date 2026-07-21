import { PageHeader } from "@/components/shared/page-header";
import { BulkEntry } from "@/components/records/bulk-entry";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

export default async function BulkRecordsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { profile } = await requireProfilePageAccess(profileId, "edit");
  const catalog = await prisma.serviceCatalog.findMany({
    where: { active: true },
    include: { methods: { where: { active: true }, orderBy: { name: "asc" } } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Bulk history"
        title="Enter several care records"
        description="Work across a keyboard-friendly history sheet, paste rows from a spreadsheet, and save only the entries that pass review."
      />
      <BulkEntry
        profileId={profile.id}
        catalog={catalog.map((service) => ({
          slug: service.slug,
          name: service.name,
          methods: service.methods.map((method) => ({ slug: method.slug, name: method.name })),
        }))}
      />
    </div>
  );
}
