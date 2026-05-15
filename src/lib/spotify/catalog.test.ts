import { describe, expect, it } from "vitest";
import { normalizeReleaseDate, pickImage, uniqById } from "./catalog";

describe("normalizeReleaseDate", () => {
  it("expands year precision to Jan 1st", () => {
    expect(normalizeReleaseDate("2023", "year")).toBe("2023-01-01");
  });

  it("expands month precision to day 1", () => {
    expect(normalizeReleaseDate("2023-04", "month")).toBe("2023-04-01");
  });

  it("passes day precision through unchanged", () => {
    expect(normalizeReleaseDate("2023-04-15", "day")).toBe("2023-04-15");
  });

  it("returns null when date is missing", () => {
    expect(normalizeReleaseDate(undefined, "day")).toBeNull();
  });
});

describe("pickImage", () => {
  it("returns null on empty array", () => {
    expect(pickImage([])).toBeNull();
  });

  it("returns null on undefined", () => {
    expect(pickImage(undefined)).toBeNull();
  });

  it("returns the first image's url", () => {
    expect(pickImage([{ url: "a" }, { url: "b" }])).toBe("a");
  });
});

describe("uniqById", () => {
  it("dedupes by id, keeping last write", () => {
    const out = uniqById([
      { id: "1", v: 1 },
      { id: "1", v: 2 },
      { id: "2", v: 3 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.id === "1")?.v).toBe(2);
  });

  it("returns empty array for empty input", () => {
    expect(uniqById([])).toEqual([]);
  });
});
