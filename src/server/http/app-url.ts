export function appUrl(
  path: string,
  requestUrl: string,
  configuredBaseUrl: string | undefined = process.env.APP_BASE_URL,
): URL {
  const baseUrl = new URL(configuredBaseUrl?.trim() ? configuredBaseUrl : requestUrl);
  const target = new URL(path, baseUrl);
  if (target.origin !== baseUrl.origin) {
    throw new RangeError("Application redirects must remain on the configured origin.");
  }
  return target;
}
