import { describe, expect, it } from "vitest";

import { normalizeUsername, validateUsername } from "./username";

describe("normalizeUsername", () => {
  it("lowercases input", () => {
    expect(normalizeUsername("JulesD")).toBe("julesd");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUsername("  jules  ")).toBe("jules");
  });

  it("handles empty input", () => {
    expect(normalizeUsername("")).toBe("");
  });
});

describe("validateUsername", () => {
  it("accepts a typical username", () => {
    expect(validateUsername("jules")).toEqual({ ok: true, value: "jules" });
  });

  it("accepts letters, digits, dashes, underscores", () => {
    expect(validateUsername("jules-d_42")).toEqual({
      ok: true,
      value: "jules-d_42",
    });
  });

  it("normalizes before validating", () => {
    expect(validateUsername("  Jules  ")).toEqual({ ok: true, value: "jules" });
  });

  it("rejects empty string", () => {
    const r = validateUsername("");
    expect(r.ok).toBe(false);
  });

  it("rejects strings shorter than 3 chars", () => {
    const r = validateUsername("ab");
    expect(r.ok).toBe(false);
  });

  it("rejects strings longer than 20 chars", () => {
    const r = validateUsername("a".repeat(21));
    expect(r.ok).toBe(false);
  });

  it("rejects starting with a digit", () => {
    expect(validateUsername("1jules").ok).toBe(false);
  });

  it("rejects starting with a dash or underscore", () => {
    expect(validateUsername("-jules").ok).toBe(false);
    expect(validateUsername("_jules").ok).toBe(false);
  });

  it("rejects forbidden characters", () => {
    expect(validateUsername("jules.d").ok).toBe(false);
    expect(validateUsername("jules d").ok).toBe(false);
    expect(validateUsername("jules@d").ok).toBe(false);
    expect(validateUsername("julés").ok).toBe(false);
  });

  it("rejects reserved usernames", () => {
    for (const reserved of [
      "admin",
      "loopstat",
      "api",
      "settings",
      "dashboard",
      "login",
      "pricing",
      "billing",
      "compare",
      "artist",
      "album",
      "track",
      "top",
      "import",
      "legal",
      "privacy",
      "terms",
    ]) {
      expect(validateUsername(reserved).ok, `should reject "${reserved}"`).toBe(
        false,
      );
    }
  });
});
