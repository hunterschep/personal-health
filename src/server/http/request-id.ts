import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/** Creates an opaque identifier that can correlate logs without carrying user data. */
export function createRequestId(): string {
  return randomUUID();
}
