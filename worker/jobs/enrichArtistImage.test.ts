import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/theaudiodb/catalog", () => ({
  enrichArtistImageByMbid: vi.fn(),
  enrichArtistImageByName: vi.fn(),
}));
vi.mock("@/lib/deezer/catalog", () => ({
  enrichArtistImageByDeezer: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichArtistImageWithFallback (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichArtistImage");
    expect(typeof mod.enrichArtistImageWithFallback).toBe("function");
  });
});
