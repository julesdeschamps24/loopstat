import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "./crypto";

describe("crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a plaintext string", () => {
    const blob = encryptToken("hello");
    expect(decryptToken(blob)).toBe("hello");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    const blob = encryptToken("hello");
    // Flip a byte in the ciphertext region (after iv 12 + tag 16 = 28).
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws when TOKEN_ENC_KEY is missing", () => {
    vi.stubEnv("TOKEN_ENC_KEY", "");
    expect(() => encryptToken("hello")).toThrow(/TOKEN_ENC_KEY/);
  });
});
