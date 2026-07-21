export function isComponentGalleryEnabled(environment: string | undefined): boolean {
  return environment === "development";
}
