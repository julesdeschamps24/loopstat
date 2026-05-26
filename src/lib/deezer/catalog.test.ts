import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as search from "./search";

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
  it("updates albums.imageUrl when cover found", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue({
      deezerAlbumId: 101,
      coverUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
    });

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "PNL",
      albumName: "Deux Frères",
    });

    expect(setMock).toHaveBeenCalledWith({
      imageUrl: "https://cdn-images.dzcdn.net/images/cover/abc.jpg",
    });
  });

  it("is a no-op when cover is null", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue({
      deezerAlbumId: 101,
      coverUrl: null,
    });

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "PNL",
      albumName: "Deux Frères",
    });

    expect(setMock).not.toHaveBeenCalled();
  });

  it("is a no-op when search returns null", async () => {
    vi.spyOn(search, "searchAlbumByName").mockResolvedValue(null);

    await enrichAlbumImageByDeezer({
      albumId: "alb_x",
      artistName: "Ghost",
      albumName: "Unknown",
    });

    expect(setMock).not.toHaveBeenCalled();
  });
});
