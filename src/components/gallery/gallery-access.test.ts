import { describe, expect, it } from "vitest";
import { isComponentGalleryEnabled } from "./gallery-access";

describe("component gallery access", () => {
  it("is enabled only in development", () => {
    expect(isComponentGalleryEnabled("development")).toBe(true);
    expect(isComponentGalleryEnabled("production")).toBe(false);
    expect(isComponentGalleryEnabled("test")).toBe(false);
    expect(isComponentGalleryEnabled(undefined)).toBe(false);
  });
});
