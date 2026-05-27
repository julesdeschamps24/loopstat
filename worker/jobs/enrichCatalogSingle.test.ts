import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("./enrichArtistImage", () => ({
  enrichArtistImage: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalogSingle (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichCatalogSingle");
    expect(typeof mod.enrichCatalogSingle).toBe("function");
  });
});
