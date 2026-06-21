import { describe, expect, it } from "vitest";

import { validateCredentials } from "./validate";

describe("validateCredentials", () => {
  it("accepts a valid email + password and normalises the email", () => {
    expect(validateCredentials("  Jules@Example.COM ", "password1")).toEqual({
      ok: true,
      email: "jules@example.com",
    });
  });

  it("rejects an invalid email", () => {
    expect(validateCredentials("not-an-email", "password1").ok).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validateCredentials("a@b.co", "short").ok).toBe(false);
  });
});
