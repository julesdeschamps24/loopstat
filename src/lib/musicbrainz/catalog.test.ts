import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrichAlbumByNames, enrichArtistByName } from "./catalog";
import * as search from "./search";
import * as coverArt from "./coverArt";

vi.mock("@/db/client", () => ({
  db: { update: vi.fn(), insert: vi.fn() },
}));

const updateMock = vi.fn().mockReturnThis();
const setMock = vi.fn().mockReturnThis();
const whereMock = vi.fn().mockResolvedValue(undefined);

beforeEach(async () => {
  const { db } = await import("@/db/client");
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
    set: setMock.mockReturnValue({ where: whereMock }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  updateMock.mockClear();
  setMock.mockClear();
  whereMock.mockClear();
});

const SENTINEL = "00000000-0000-0000-0000-000000000000";

describe("enrichAlbumByNames", () => {
  it("updates album with mbid + cover + metadata on full match", async () => {
    vi.spyOn(search, "searchReleaseGroup").mockResolvedValue({
      mbid: "rg-abc",
      score: 100,
      primaryType: "Album",
      firstReleaseDate: "2024-08-23",
      totalTracks: 12,
    });
    vi.spyOn(coverArt, "fetchCoverUrl").mockResolvedValue(
      "https://archive.org/x.jpg",
    );

    await enrichAlbumByNames({
      albumId: "alb_x",
      artistName: "Sabrina Carpenter",
      albumName: "Short n' Sweet",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mbid: "rg-abc",
        imageUrl: "https://archive.org/x.jpg",
        releaseDate: "2024-08-23",
        albumType: "Album",
        totalTracks: 12,
      }),
    );
  });

  it("stores sentinel mbid when no match", async () => {
    vi.spyOn(search, "searchReleaseGroup").mockResolvedValue(null);

    await enrichAlbumByNames({
      albumId: "alb_x",
      artistName: "X",
      albumName: "Y",
    });

    expect(setMock).toHaveBeenCalledWith({ mbid: SENTINEL });
  });

  it("stores mbid but null image on CAA 404", async () => {
    vi.spyOn(search, "searchReleaseGroup").mockResolvedValue({
      mbid: "rg-abc",
      score: 100,
    });
    vi.spyOn(coverArt, "fetchCoverUrl").mockResolvedValue(null);

    await enrichAlbumByNames({
      albumId: "alb_x",
      artistName: "X",
      albumName: "Y",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ mbid: "rg-abc", imageUrl: null }),
    );
  });
});

describe("enrichArtistByName", () => {
  it("updates artist with mbid on match", async () => {
    vi.spyOn(search, "searchArtist").mockResolvedValue({
      mbid: "art-abc",
      score: 95,
    });

    await enrichArtistByName({ artistId: "art_x", name: "Sabrina Carpenter" });

    expect(setMock).toHaveBeenCalledWith({ mbid: "art-abc" });
  });

  it("stores sentinel mbid when no match", async () => {
    vi.spyOn(search, "searchArtist").mockResolvedValue(null);

    await enrichArtistByName({ artistId: "art_x", name: "X" });

    expect(setMock).toHaveBeenCalledWith({ mbid: SENTINEL });
  });
});
