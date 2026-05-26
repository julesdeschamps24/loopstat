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

describe("getTopAlbumIdsForUser with since", () => {
  it("accepts an optional `since` Date parameter", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
      yearAgo,
    );
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toEqual([]);
  });

  it("backward-compat : called without `since` returns lifetime", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
    );
    expect(Array.isArray(ids)).toBe(true);
  });
});

describe("getTopArtistIdsForUser with since", () => {
  it("accepts an optional `since` parameter", async () => {
    const { getTopArtistIdsForUser } = await import("./enrich");
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ids = await getTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
      yearAgo,
    );
    expect(ids).toEqual([]);
  });
});

describe("getTopTrackAlbumIdsForUser with since", () => {
  it("accepts an optional `since` parameter", async () => {
    const { getTopTrackAlbumIdsForUser } = await import("./enrich");
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ids = await getTopTrackAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
      yearAgo,
    );
    expect(ids).toEqual([]);
  });
});

describe("getOrderedTopAlbumIdsForUser", () => {
  it("returns empty array for non-existent user", async () => {
    const { getOrderedTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(ids).toEqual([]);
  });

  it("returns deduped string array shape", async () => {
    const { getOrderedTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(Array.isArray(ids)).toBe(true);
    // Dedup check : Set size == array length means no duplicates
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getOrderedTopArtistIdsForUser", () => {
  it("returns deduped string array", async () => {
    const { getOrderedTopArtistIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(ids).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getOrderedTopTrackAlbumIdsForUser", () => {
  it("returns deduped string array", async () => {
    const { getOrderedTopTrackAlbumIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopTrackAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(ids).toEqual([]);
  });
});
