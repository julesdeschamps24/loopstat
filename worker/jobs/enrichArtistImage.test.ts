import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/deezer/catalog", () => ({
  enrichArtistImageByDeezer: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichArtistImage (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichArtistImage");
    expect(typeof mod.enrichArtistImage).toBe("function");
  });
});
