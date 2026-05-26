import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/musicbrainz/catalog", () => ({
  enrichAlbumByNames: vi.fn(),
  enrichArtistByName: vi.fn(),
}));
vi.mock("@/lib/theaudiodb/catalog", () => ({
  enrichArtistImageByMbid: vi.fn(),
  enrichArtistImageByName: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalogSingle (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichCatalogSingle");
    expect(typeof mod.enrichCatalogSingle).toBe("function");
  });
});
