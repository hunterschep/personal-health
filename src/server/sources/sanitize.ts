import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import type { JsonValue } from "./hash";

const myHealthfinderResourceSchema = z
  .object({
    Type: z.string().min(1),
    Id: z.union([z.string(), z.number()]),
    Title: z.string().min(1),
    LastUpdate: z.union([z.string(), z.number()]).optional(),
    AccessibleVersion: z.url().optional(),
  })
  .passthrough();

const oneOrManyResourcesSchema = z.union([
  myHealthfinderResourceSchema,
  z.array(myHealthfinderResourceSchema),
]);

export const myHealthfinderPayloadSchema = z
  .object({
    Result: z
      .object({
        Error: z.union([z.boolean(), z.enum(["True", "False", "true", "false"])]),
        Total: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
        Query: z.object({ ApiVersion: z.literal("4") }).passthrough(),
        Resources: z
          .object({
            All: z.object({ Resource: oneOrManyResourcesSchema }).passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((payload, context) => {
    if (
      payload.Result.Error === true ||
      payload.Result.Error === "True" ||
      payload.Result.Error === "true"
    ) {
      context.addIssue({ code: "custom", message: "MyHealthfinder returned an error payload." });
    }
  });

export type MyHealthfinderPayload = z.infer<typeof myHealthfinderPayloadSchema>;

const HTML_FIELD_NAMES = new Set([
  "AboutTheseResults",
  "Content",
  "MyHFCategoryHeading",
  "MoreInfo",
]);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
    "blockquote",
    "abbr",
    "span",
    "sup",
    "sub",
    "table",
    "caption",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    abbr: ["title"],
    th: ["scope", "colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["https"],
  allowedSchemesByTag: { a: ["https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: true,
};

export function sanitizeExternalHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

function sanitizePayloadValue(value: unknown, key: string | null): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return key !== null && HTML_FIELD_NAMES.has(key) ? sanitizeExternalHtml(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadValue(item, null));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizePayloadValue(childValue, childKey),
      ]),
    );
  }

  throw new TypeError("MyHealthfinder payload contains a non-JSON value.");
}

export function sanitizeMyHealthfinderPayload(payload: unknown): MyHealthfinderPayload {
  const parsed = myHealthfinderPayloadSchema.parse(payload);
  const sanitized = sanitizePayloadValue(parsed, null);
  return myHealthfinderPayloadSchema.parse(sanitized);
}
