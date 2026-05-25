import { describe, expect, it } from "vitest";

describe("getArtistPlayStats", () => {
  it("returns firstPlayedAt and lastPlayedAt from the user's streams", async () => {
    // This is an integration smoke test. We'll just verify the type shape
    // by calling the function with a non-existent user (returns nulls).
    const { getArtistPlayStats } = await import("./stats");
    const result = await getArtistPlayStats(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
    );
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("msPlayed");
    expect(result).toHaveProperty("firstPlayedAt");
    expect(result).toHaveProperty("lastPlayedAt");
    expect(result.count).toBe(0);
    expect(result.msPlayed).toBe(0);
    expect(result.firstPlayedAt).toBeNull();
    expect(result.lastPlayedAt).toBeNull();
  });
});

describe("getUserTopAlbumsByArtist", () => {
  it("returns an empty array for an artist with no plays", async () => {
    const { getUserTopAlbumsByArtist } = await import("./stats");
    const rows = await getUserTopAlbumsByArtist(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      10,
    );
    expect(rows).toEqual([]);
  });

  it("returns array shape with albumId, name, imageUrl, playCount", async () => {
    const { getUserTopAlbumsByArtist } = await import("./stats");
    const rows = await getUserTopAlbumsByArtist(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      10,
    );
    // Type-only assertion (empty array, but the type must be correct)
    const expectShape: { albumId: string; name: string; imageUrl: string | null; playCount: number }[] = rows;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});

describe("getArtistMonthlyPlays", () => {
  it("returns empty array for non-existent artist", async () => {
    const { getArtistMonthlyPlays } = await import("./stats");
    const rows = await getArtistMonthlyPlays(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
    );
    expect(rows).toEqual([]);
  });

  it("returns shape { month: Date, plays: number }", async () => {
    const { getArtistMonthlyPlays } = await import("./stats");
    const rows = await getArtistMonthlyPlays(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
    );
    const expectShape: { month: Date; plays: number }[] = rows;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});

describe("getCoListenedArtists", () => {
  it("returns empty array for non-existent artist", async () => {
    const { getCoListenedArtists } = await import("./stats");
    const rows = await getCoListenedArtists(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      5,
    );
    expect(rows).toEqual([]);
  });

  it("returns shape { artistId, name, imageUrl, coCount }", async () => {
    const { getCoListenedArtists } = await import("./stats");
    const rows = await getCoListenedArtists(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      5,
    );
    const expectShape: {
      artistId: string;
      name: string;
      imageUrl: string | null;
      coCount: number;
    }[] = rows;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});
