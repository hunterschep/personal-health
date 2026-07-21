import JSZip from "jszip";

import { canExportProfile } from "@/server/authorization/policy";
import { prisma } from "@/server/db/client";

import { addProfileExportFiles } from "./profile";

export type HouseholdExportAuthorization = {
  authorizedProfileIds: string[];
  omittedProfileIds: string[];
};

export async function resolveHouseholdExportProfiles(
  householdId: string,
  userId: string,
): Promise<HouseholdExportAuthorization> {
  const household = await prisma.household.findFirst({
    where: { id: householdId, deletedAt: null },
    include: {
      members: { where: { userId, removedAt: null } },
      profiles: {
        where: { deletedAt: null },
        include: { accessGrants: { where: { userId }, take: 1 } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const membership = household?.members[0];
  if (
    household === null ||
    household === undefined ||
    membership === undefined ||
    membership.role !== "owner"
  ) {
    return { authorizedProfileIds: [], omittedProfileIds: [] };
  }

  const authorizedProfileIds: string[] = [];
  const omittedProfileIds: string[] = [];
  for (const profile of household.profiles) {
    const allowed = canExportProfile({
      userId,
      profile,
      membership: { role: membership.role, removedAt: membership.removedAt },
      grant:
        profile.accessGrants[0] === undefined
          ? null
          : { permission: profile.accessGrants[0].permission },
    });
    (allowed ? authorizedProfileIds : omittedProfileIds).push(profile.id);
  }
  return { authorizedProfileIds, omittedProfileIds };
}

export async function createHouseholdExport(
  householdId: string,
  userId: string,
  generatedAt = new Date(),
): Promise<{ archive: Buffer; authorizedProfileIds: string[]; omittedProfileIds: string[] }> {
  const household = await prisma.household.findFirst({
    where: { id: householdId, deletedAt: null },
    include: {
      members: {
        where: { removedAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (household === null) throw new RangeError("The household is no longer available.");
  const requestingMembership = household.members.find((member) => member.user.id === userId);
  if (requestingMembership?.role !== "owner") {
    throw new RangeError("The household is no longer available.");
  }
  const authorization = await resolveHouseholdExportProfiles(householdId, userId);
  if (authorization.authorizedProfileIds.length > 50) {
    throw new RangeError("Household exports are limited to 50 authorized profiles at a time.");
  }
  const documentStats = await prisma.document.aggregate({
    where: { profileId: { in: authorization.authorizedProfileIds }, deletedAt: null },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  });
  if (documentStats._count._all > 250) {
    throw new RangeError("Household exports are limited to 250 documents at a time.");
  }
  if ((documentStats._sum.sizeBytes ?? 0n) > 250n * 1024n * 1024n) {
    throw new RangeError("Household documents exceed the 250 MB export limit.");
  }
  const zip = new JSZip();
  const profileFiles: Record<string, string[]> = {};
  for (const profileId of authorization.authorizedProfileIds) {
    const folder = zip.folder(`profiles/${profileId}`);
    if (folder === null) throw new Error("Could not create the profile export folder.");
    profileFiles[profileId] = await addProfileExportFiles(folder, profileId, generatedAt);
  }

  const householdJson = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    household: {
      id: household.id,
      name: household.name,
      timezone: household.timezone,
      countryCode: household.countryCode,
      members: household.members.map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
    },
    includedProfileIds: authorization.authorizedProfileIds,
    omittedProfiles: authorization.omittedProfileIds.map((profileId) => ({
      profileId,
      reason: "Current profile export permission is required.",
    })),
  };
  zip.file("household.json", JSON.stringify(householdJson, null, 2));
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        schemaVersion: "1.0",
        generatedAt: generatedAt.toISOString(),
        appVersion: process.env.npm_package_version ?? "0.1.0",
        profileCount: authorization.authorizedProfileIds.length,
        omittedPrivateProfileCount: authorization.omittedProfileIds.length,
        files: [
          "household.json",
          "manifest.json",
          "README.txt",
          ...Object.entries(profileFiles).flatMap(([profileId, files]) =>
            files.map((file) => `profiles/${profileId}/${file}`),
          ),
        ],
      },
      null,
      2,
    ),
  );
  zip.file(
    "README.txt",
    [
      "CareCadence household export",
      "",
      `Generated: ${generatedAt.toISOString()}`,
      "Only profiles the requesting owner was authorized to export are included.",
      "The manifest records omitted private profiles without including their medical contents.",
      "This archive contains private information. Store and share it carefully.",
    ].join("\r\n"),
  );
  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { archive, ...authorization };
}
