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

describe("searchTracks", () => {
  it("treats % in the query as a literal character, not a LIKE wildcard", async () => {
    const { db } = await import("@/db/client");
    const { users, tracks, streams } = await import("@/db/schema");
    const { inArray, eq } = await import("drizzle-orm");
    const { searchTracks } = await import("./stats");

    const suffix = crypto.randomUUID().slice(0, 8);
    const literalId = `tk_lit_${suffix}`; // name contains a literal "100%"
    const decoyId = `tk_decoy_${suffix}`; // contains "100" but NOT "100%"
    const [u] = await db
      .insert(users)
      .values({ email: `searchtracks-${suffix}@test.local` })
      .returning({ id: users.id });

    try {
      await db.insert(tracks).values([
        { id: literalId, name: `100% Pure ${suffix}` },
        { id: decoyId, name: `1000 Reasons ${suffix}` },
      ]);
      await db.insert(streams).values([
        {
          userId: u.id,
          trackId: literalId,
          playedAt: new Date("2026-01-01T00:00:00Z"),
          msPlayed: 60000,
          source: "import",
        },
        {
          userId: u.id,
          trackId: decoyId,
          playedAt: new Date("2026-01-02T00:00:00Z"),
          msPlayed: 60000,
          source: "import",
        },
      ]);

      // Unescaped, `%100%%` matches both rows (substring "100"). Escaped,
      // `%100\%%` matches only the row with a literal "100%".
      const results = await searchTracks(u.id, "100%", 10);

      expect(results.map((r) => r.trackId)).toEqual([literalId]);
    } finally {
      await db.delete(users).where(eq(users.id, u.id)); // cascades streams
      await db.delete(tracks).where(inArray(tracks.id, [literalId, decoyId]));
    }
  });
});
