import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupArtistByMbid, searchArtistByName } from "./search";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("lookupArtistByMbid", () => {
  it("returns tadbId + thumbUrl on match", async () => {
    mockFetch({
      artists: [
        {
          idArtist: "111239",
          strArtist: "Coldplay",
          strArtistThumb: "https://r2.theaudiodb.com/thumb.jpg",
        },
      ],
    });
    expect(
      await lookupArtistByMbid({ mbid: "cc197bad-dc9c-440d-a5b5-d52ba2e14234" }),
    ).toEqual({ tadbId: 111239, thumbUrl: "https://r2.theaudiodb.com/thumb.jpg" });
  });

  it("returns null when artists is null", async () => {
    mockFetch({ artists: null });
    expect(
      await lookupArtistByMbid({ mbid: "x" }),
    ).toBeNull();
  });

  it("returns null when artists is empty array", async () => {
    mockFetch({ artists: [] });
    expect(
      await lookupArtistByMbid({ mbid: "x" }),
    ).toBeNull();
  });

  it("returns null thumbUrl when strArtistThumb is empty string", async () => {
    mockFetch({
      artists: [{ idArtist: "999", strArtistThumb: "" }],
    });
    expect(
      await lookupArtistByMbid({ mbid: "x" }),
    ).toEqual({ tadbId: 999, thumbUrl: null });
  });

  it("calls /artist-mb.php?i=<mbid>", async () => {
    const fetchMock = mockFetch({ artists: null });
    await lookupArtistByMbid({ mbid: "abc-123" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/artist-mb.php?i=abc-123");
  });
});

describe("searchArtistByName", () => {
  it("returns tadbId + thumbUrl on match", async () => {
    mockFetch({
      artists: [
        { idArtist: "111239", strArtistThumb: "https://r2.theaudiodb.com/thumb.jpg" },
      ],
    });
    expect(await searchArtistByName({ name: "Coldplay" })).toEqual({
      tadbId: 111239,
      thumbUrl: "https://r2.theaudiodb.com/thumb.jpg",
    });
  });

  it("returns null when artists is null", async () => {
    mockFetch({ artists: null });
    expect(await searchArtistByName({ name: "Unknown" })).toBeNull();
  });

  it("URL-encodes the name", async () => {
    const fetchMock = mockFetch({ artists: null });
    await searchArtistByName({ name: "Beyoncé & Jay-Z" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/search.php?s=Beyonc%C3%A9%20%26%20Jay-Z");
  });
});
