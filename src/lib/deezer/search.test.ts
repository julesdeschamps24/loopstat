import { afterEach, describe, expect, it, vi } from "vitest";
import { searchArtistByName } from "./search";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("searchArtistByName", () => {
  it("returns deezerId + pictureUrl on match", async () => {
    mockFetch({
      data: [
        { id: 56, name: "PNL", picture_medium: "https://cdn-images.dzcdn.net/images/artist/pnl.jpg" },
      ],
    });
    expect(await searchArtistByName({ name: "PNL" })).toEqual({
      deezerId: 56,
      pictureUrl: "https://cdn-images.dzcdn.net/images/artist/pnl.jpg",
    });
  });

  it("returns null when data is null", async () => {
    mockFetch({ data: null });
    expect(await searchArtistByName({ name: "Unknown" })).toBeNull();
  });

  it("returns null when data is empty array", async () => {
    mockFetch({ data: [] });
    expect(await searchArtistByName({ name: "Empty" })).toBeNull();
  });

  it("returns null pictureUrl when picture_medium is empty string", async () => {
    mockFetch({ data: [{ id: 42, picture_medium: "" }] });
    expect(await searchArtistByName({ name: "X" })).toEqual({
      deezerId: 42,
      pictureUrl: null,
    });
  });

  it("URL-encodes the artist name", async () => {
    const fetchMock = mockFetch({ data: null });
    await searchArtistByName({ name: "Booba & Kaaris" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/search/artist?q=Booba%20%26%20Kaaris&limit=1");
  });
});
