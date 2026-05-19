import { describe, expect, it } from "vitest";
import { synthesizeAlbumId, synthesizeArtistId } from "./synthesize";

describe("synthesizeArtistId", () => {
  it("returns stable id with art_ prefix", () => {
    expect(synthesizeArtistId("Sabrina Carpenter")).toMatch(/^art_[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    expect(synthesizeArtistId("Sabrina Carpenter")).toBe(
      synthesizeArtistId("Sabrina Carpenter"),
    );
  });

  it("differs for different names", () => {
    expect(synthesizeArtistId("Sabrina Carpenter")).not.toBe(
      synthesizeArtistId("Billie Eilish"),
    );
  });

  it("is case-insensitive and trim-insensitive", () => {
    expect(synthesizeArtistId("Sabrina Carpenter"))
      .toBe(synthesizeArtistId("  sabrina carpenter  "));
  });
});

describe("synthesizeAlbumId", () => {
  it("returns stable id with alb_ prefix", () => {
    expect(synthesizeAlbumId("Sabrina Carpenter", "Short n' Sweet"))
      .toMatch(/^alb_[a-f0-9]{16}$/);
  });

  it("changes if artist changes (no collision for homonymous album names)", () => {
    const a = synthesizeAlbumId("Beyoncé", "Lemonade");
    const b = synthesizeAlbumId("Adele", "Lemonade");
    expect(a).not.toBe(b);
  });

  it("changes if album changes", () => {
    const a = synthesizeAlbumId("Sabrina Carpenter", "emails i can't send");
    const b = synthesizeAlbumId("Sabrina Carpenter", "Short n' Sweet");
    expect(a).not.toBe(b);
  });

  it("is case-insensitive and trim-insensitive", () => {
    expect(synthesizeAlbumId("Sabrina Carpenter", "Short n' Sweet"))
      .toBe(synthesizeAlbumId("  SABRINA carpenter  ", " short N' sweet "));
  });
});
