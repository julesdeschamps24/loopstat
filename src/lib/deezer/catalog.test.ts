import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as search from "./search";
import { fetchAlbumDetails } from "./album";

vi.mock("./album", () => ({
  fetchAlbumDetails: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { update: vi.fn() },
}));

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
  setMock.mockClear();
  whereMock.mockClear();
});

import { enrichAlbumImageByDeezer, enrichArtistImageByDeezer } from "./catalog";

describe("enrichArtistImageByDeezer", () => {
  it("updates artist with deezerId + imageUrl on match with picture", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue({
      deezerId: 56,
      pictureUrl: "https://cdn-images.dzcdn.net/images/artist/pnl.jpg",
    });

    await enrichArtistImageByDeezer({ artistId: "art_x", name: "PNL" });

    expect(setMock).toHaveBeenCalledWith({
      deezerId: 56,
      imageUrl: "https://cdn-images.dzcdn.net/images/artist/pnl.jpg",
    });
  });

  it("stores sentinel deezerId=0 when no match", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue(null);

    await enrichArtistImageByDeezer({ artistId: "art_x", name: "Unknown" });

    expect(setMock).toHaveBeenCalledWith({ deezerId: 0 });
  });

  it("stores deezerId but null imageUrl when picture missing", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue({
      deezerId: 99,
      pictureUrl: null,
    });

    await enrichArtistImageByDeezer({ artistId: "art_x", name: "NoPic" });

    expect(setMock).toHaveBeenCalledWith({ deezerId: 99, imageUrl: null });
  });
});

describe("enrichAlbumImageByDeezer", () => {
  it("writes deezerId + imageUrl + releaseDate on full hit", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue({
      deezerAlbumId: 101,
      coverUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
    });
    vi.mocked(fetchAlbumDetails).mockResolvedValue({ releaseDate: "2024-01-15" });

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "PNL",
      albumName: "Deux Frères",
    });

    expect(setMock).toHaveBeenCalledWith({
      deezerId: 101,
      imageUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
      releaseDate: "2024-01-15",
    });
  });

  it("writes deezerId + imageUrl with releaseDate null when details miss", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue({
      deezerAlbumId: 101,
      coverUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
    });
    vi.mocked(fetchAlbumDetails).mockResolvedValue({ releaseDate: null });

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "PNL",
      albumName: "Deux Frères",
    });

    expect(setMock).toHaveBeenCalledWith({
      deezerId: 101,
      imageUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
      releaseDate: null,
    });
  });

  it("swallows fetchAlbumDetails errors and persists with releaseDate null", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue({
      deezerAlbumId: 101,
      coverUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
    });
    vi.mocked(fetchAlbumDetails).mockRejectedValue(new Error("network"));

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "PNL",
      albumName: "Deux Frères",
    });

    expect(setMock).toHaveBeenCalledWith({
      deezerId: 101,
      imageUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
      releaseDate: null,
    });
  });

  it("writes sentinel deezerId=0 when search returns null", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue(null);

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "Ghost",
      albumName: "Unknown",
    });

    expect(setMock).toHaveBeenCalledWith({ deezerId: 0 });
  });

  it("writes deezerId + null imageUrl when match has no cover", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue({
      deezerAlbumId: 101,
      coverUrl: null,
    });
    vi.mocked(fetchAlbumDetails).mockResolvedValue({ releaseDate: "2024-01-15" });

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "PNL",
      albumName: "Deux Frères",
    });

    expect(setMock).toHaveBeenCalledWith({
      deezerId: 101,
      imageUrl: null,
      releaseDate: "2024-01-15",
    });
  });
});
