import { describe, expect, it } from "vitest";
import { cn, formatMs, formatNumber } from "./utils";

describe("formatNumber", () => {
  it("formats integers with fr-FR grouping", () => {
    // fr-FR uses a narrow no-break space (U+202F) as group separator.
    expect(formatNumber(1234)).toMatch(/^1[\s  ]234$/);
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats negatives", () => {
    expect(formatNumber(-1234)).toMatch(/^-1[\s  ]234$/);
  });
});

describe("formatMs", () => {
  it("formats values under one hour as minutes", () => {
    expect(formatMs(45 * 60_000)).toBe("45 min");
  });

  it("formats values over one hour as hours + minutes", () => {
    expect(formatMs(2 * 3_600_000 + 5 * 60_000)).toBe("2h 5m");
  });

  it("formats values over one day as days + hours", () => {
    expect(formatMs(26 * 3_600_000)).toBe("1j 2h");
  });
});

describe("cn", () => {
  it("merges simple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("drops falsy values", () => {
    expect(cn("foo", false && "bar", undefined, null)).toBe("foo");
  });

  it("resolves tailwind collisions via twMerge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
