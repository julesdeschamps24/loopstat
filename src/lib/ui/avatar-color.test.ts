import { describe, expect, it } from "vitest";
import { avatarGradient } from "./avatar-color";

describe("avatarGradient", () => {
  it("returns a CSS gradient string", () => {
    const g = avatarGradient("Sabrina Carpenter");
    expect(g).toMatch(/^linear-gradient\(135deg,/);
  });

  it("is deterministic for same input", () => {
    expect(avatarGradient("X")).toBe(avatarGradient("X"));
  });

  it("differs for different inputs", () => {
    expect(avatarGradient("Sabrina")).not.toBe(avatarGradient("Billie"));
  });
});
