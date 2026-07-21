import { describe, expect, it } from "vitest";
import { paginationTokens } from "./navigation";

describe("pagination tokens", () => {
  it("keeps the current page and both boundaries visible", () => {
    expect(paginationTokens(6, 12)).toEqual([1, "ellipsis-start", 5, 6, 7, "ellipsis-end", 12]);
    expect(paginationTokens(1, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 12]);
    expect(paginationTokens(12, 12)).toEqual([1, "ellipsis-start", 8, 9, 10, 11, 12]);
  });
});
