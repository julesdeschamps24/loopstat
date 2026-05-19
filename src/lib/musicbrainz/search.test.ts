import { afterEach, describe, expect, it, vi } from "vitest";
import { searchArtist, searchReleaseGroup } from "./search";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("searchReleaseGroup", () => {
  it("returns mbid + metadata when top result scores ≥ 90", async () => {
    mockFetch({
      "release-groups": [
        {
          id: "abc-1234",
          score: 100,
          title: "Short n' Sweet",
          "primary-type": "Album",
          "first-release-date": "2024-08-23",
          releases: [{ id: "rel-1", media: [{ "track-count": 12 }] }],
        },
      ],
    });
    const result = await searchReleaseGroup({
      artist: "Sabrina Carpenter",
      album: "Short n' Sweet",
    });
    expect(result).toEqual({
      mbid: "abc-1234",
      score: 100,
      primaryType: "Album",
      firstReleaseDate: "2024-08-23",
      totalTracks: 12,
    });
  });

  it("returns null when top result scores < 90", async () => {
    mockFetch({
      "release-groups": [{ id: "x", score: 50, title: "Wrong Match" }],
    });
    expect(
      await searchReleaseGroup({ artist: "X", album: "Y" }),
    ).toBeNull();
  });

  it("returns null when no results", async () => {
    mockFetch({ "release-groups": [] });
    expect(
      await searchReleaseGroup({ artist: "X", album: "Y" }),
    ).toBeNull();
  });

  it("escapes double quotes in query", async () => {
    const fetchMock = mockFetch({ "release-groups": [] });
    await searchReleaseGroup({ artist: 'X "y" Z', album: "A" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('artist:%22X%20%5C%22y%5C%22%20Z%22');
  });
});

describe("searchArtist", () => {
  it("returns mbid when score ≥ 90", async () => {
    mockFetch({
      artists: [{ id: "art-uuid", score: 95, name: "Sabrina Carpenter" }],
    });
    expect(await searchArtist("Sabrina Carpenter")).toEqual({
      mbid: "art-uuid",
      score: 95,
    });
  });

  it("returns null when score < 90", async () => {
    mockFetch({ artists: [{ id: "x", score: 70, name: "Wrong" }] });
    expect(await searchArtist("X")).toBeNull();
  });
});
