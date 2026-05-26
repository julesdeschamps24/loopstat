import { describe, expect, it } from "vitest";

describe("getTopAlbumIdsForUser", () => {
  it("returns empty array for non-existent user", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      100,
    );
    expect(ids).toEqual([]);
  });

  it("returns shape string[]", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      100,
    );
    const expectShape: string[] = ids;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});

describe("getTopArtistIdsForUser", () => {
  it("returns empty array for non-existent user", async () => {
    const { getTopArtistIdsForUser } = await import("./enrich");
    const ids = await getTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      50,
    );
    expect(ids).toEqual([]);
  });

  it("returns shape string[]", async () => {
    const { getTopArtistIdsForUser } = await import("./enrich");
    const ids = await getTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      50,
    );
    const expectShape: string[] = ids;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});
