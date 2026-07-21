import { z } from "zod";

export const exportManifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime(),
  appVersion: z.string(),
  profileCount: z.number().int().nonnegative(),
  omittedPrivateProfileCount: z.number().int().nonnegative(),
  files: z.array(z.string()),
});
export type ExportManifest = z.infer<typeof exportManifestSchema>;
