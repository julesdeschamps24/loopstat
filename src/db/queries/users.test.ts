import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "./users";

describe("escapeLikePattern", () => {
  it("returns plain text unchanged", () => {
    expect(escapeLikePattern("jules")).toBe("jules");
  });

  it("escapes Postgres LIKE wildcard %", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("%foo%")).toBe("\\%foo\\%");
  });

  it("escapes Postgres LIKE wildcard _", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes the escape char itself", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("handles empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });

  it("escapes multiple wildcards mixed with plain text", () => {
    expect(escapeLikePattern("100% off user_name")).toBe("100\\% off user\\_name");
    expect(escapeLikePattern("weird\\value")).toBe("weird\\\\value");
  });
});
