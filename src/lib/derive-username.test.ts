import { describe, expect, it } from "vitest";

import { deriveUsername, withUniqueSuffix } from "./derive-username";
import { validateUsername } from "./username";

describe("deriveUsername", () => {
  it("slugifies a simple display name", () => {
    expect(deriveUsername("Jules", "spotify123")).toBe("jules");
  });

  it("lowercases and replaces spaces with dashes", () => {
    expect(deriveUsername("Jules D", "spotify123")).toBe("jules-d");
  });

  it("strips accents", () => {
    expect(deriveUsername("Jérôme", "spotify123")).toBe("jerome");
  });

  it("collapses repeated dashes", () => {
    expect(deriveUsername("a  b   c", "spotify123")).toBe("a-b-c");
  });

  it("trims leading/trailing dashes", () => {
    expect(deriveUsername("  -jules-  ", "spotify123")).toBe("jules");
  });

  it("falls back to spotifyId when displayName is empty", () => {
    const slug = deriveUsername("", "spotify31abcdef");
    expect(slug.length).toBeGreaterThanOrEqual(3);
    expect(slug).toMatch(/^[a-z]/);
  });

  it("falls back to spotifyId when displayName is null", () => {
    const slug = deriveUsername(null, "spotify31abcdef");
    expect(slug.length).toBeGreaterThanOrEqual(3);
  });

  it("ensures starts with a letter", () => {
    expect(deriveUsername("42", "spotify123")).toMatch(/^[a-z]/);
  });

  it("truncates to 20 chars max", () => {
    expect(deriveUsername("a".repeat(50), "spotify123").length).toBeLessThanOrEqual(20);
  });

  it("never produces an invalid output (fuzz-ish)", () => {
    const inputs = [
      "", "  ", "@@@", "🎵🎶", "Jules D.", "user.name", "über",
      "a", "ab", "1234", "_jules", "-jules", "JULES",
    ];
    for (const name of inputs) {
      const slug = deriveUsername(name, "31AbCdEf12345678");
      const v = validateUsername(slug);
      expect(v.ok, `expected "${slug}" (from "${name}") to be valid`).toBe(true);
    }
  });
});

describe("withUniqueSuffix", () => {
  it("appends a short suffix from spotifyId", () => {
    const slug = withUniqueSuffix("jules", "31AbCdEf12345678");
    expect(slug.startsWith("jules-")).toBe(true);
    expect(slug.length).toBeLessThanOrEqual(20);
  });

  it("truncates base to fit suffix in 20 chars", () => {
    const slug = withUniqueSuffix("a".repeat(20), "31AbCdEf12345678");
    expect(slug.length).toBeLessThanOrEqual(20);
  });

  it("produces a valid username", () => {
    const slug = withUniqueSuffix("jules", "31AbCdEf12345678");
    expect(validateUsername(slug).ok).toBe(true);
  });
});
