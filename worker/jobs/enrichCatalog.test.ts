import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/musicbrainz/catalog", () => ({
  enrichAlbumByNames: vi.fn(),
  enrichArtistByName: vi.fn(),
}));
vi.mock("./enrichArtistImage", () => ({
  enrichArtistImageWithFallback: vi.fn(),
}));
vi.mock("../queue", () => ({
  enrichCatalogQueue: { getJob: vi.fn(), add: vi.fn() },
  ENRICH_CATALOG_QUEUE_NAME: "enrich-catalog",
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalog (smoke)", () => {
  it("exports the expected functions", async () => {
    const mod = await import("./enrichCatalog");
    expect(typeof mod.enrichCatalog).toBe("function");
    expect(typeof mod.selfHealEnrichCatalog).toBe("function");
  });
});
