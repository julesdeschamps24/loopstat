import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/musicbrainz/catalog", () => ({
  enrichAlbumByNames: vi.fn(),
  enrichArtistByName: vi.fn(),
}));
vi.mock("@/lib/musicbrainz/client", () => ({ MusicBrainzError: class {} }));
vi.mock("@/lib/theaudiodb/catalog", () => ({
  enrichArtistImageByMbid: vi.fn(),
  enrichArtistImageByName: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalogPriority (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichCatalogPriority");
    expect(typeof mod.enrichCatalogPriority).toBe("function");
  });

  it("returns early when both lists are empty", async () => {
    const { enrichCatalogPriority } = await import("./enrichCatalogPriority");
    const result = await enrichCatalogPriority({
      userId: "u1",
      albumIds: [],
      artistIds: [],
    });
    expect(result.albumsEnriched).toBe(0);
    expect(result.artistsEnriched).toBe(0);
    expect(result.imagesEnriched).toBe(0);
  });
});
