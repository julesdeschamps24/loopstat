import { describe, expect, it } from "vitest";
import { SpotifyError } from "./client";

describe("SpotifyError", () => {
  it("is a real Error subclass with populated fields", () => {
    const err = new SpotifyError(404, "/tracks/x", "not found");
    expect(err).toBeInstanceOf(SpotifyError);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.path).toBe("/tracks/x");
    expect(err.bodyText).toBe("not found");
    expect(err.name).toBe("SpotifyError");
    expect(err.message).toContain("404");
    expect(err.message).toContain("/tracks/x");
  });

  it("carries an optional retryAfterMs", () => {
    const err = new SpotifyError(429, "/me/player/recently-played", "rate", 2500);
    expect(err.retryAfterMs).toBe(2500);
  });
});
