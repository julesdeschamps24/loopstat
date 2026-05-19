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

import { enrichArtistImageByMbid, enrichArtistImageByName } from "./catalog";

describe("enrichArtistImageByMbid", () => {
  it("updates artist with tadbId + imageUrl on match", async () => {
    vi.spyOn(search, "lookupArtistByMbid").mockResolvedValue({
      tadbId: 111239,
      thumbUrl: "https://r2.theaudiodb.com/thumb.jpg",
    });

    await enrichArtistImageByMbid({ artistId: "art_x", mbid: "abc" });

    expect(setMock).toHaveBeenCalledWith({
      tadbId: 111239,
      imageUrl: "https://r2.theaudiodb.com/thumb.jpg",
    });
  });

  it("stores sentinel tadbId=0 when no match", async () => {
    vi.spyOn(search, "lookupArtistByMbid").mockResolvedValue(null);

    await enrichArtistImageByMbid({ artistId: "art_x", mbid: "abc" });

    expect(setMock).toHaveBeenCalledWith({ tadbId: 0 });
  });

  it("stores tadbId but null imageUrl when thumb missing", async () => {
    vi.spyOn(search, "lookupArtistByMbid").mockResolvedValue({
      tadbId: 999,
      thumbUrl: null,
    });

    await enrichArtistImageByMbid({ artistId: "art_x", mbid: "abc" });

    expect(setMock).toHaveBeenCalledWith({ tadbId: 999, imageUrl: null });
  });
});

describe("enrichArtistImageByName", () => {
  it("updates artist on match", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue({
      tadbId: 555,
      thumbUrl: "https://r2.theaudiodb.com/t.jpg",
    });

    await enrichArtistImageByName({ artistId: "art_x", name: "Coldplay" });

    expect(setMock).toHaveBeenCalledWith({
      tadbId: 555,
      imageUrl: "https://r2.theaudiodb.com/t.jpg",
    });
  });

  it("stores sentinel on no match", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue(null);

    await enrichArtistImageByName({ artistId: "art_x", name: "X" });

    expect(setMock).toHaveBeenCalledWith({ tadbId: 0 });
  });
});
