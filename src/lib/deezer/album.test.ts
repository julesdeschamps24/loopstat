import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAlbumDetails } from "./album";

vi.mock("./client", () => ({
  deezerFetch: vi.fn(),
}));

import { deezerFetch } from "./client";

describe("fetchAlbumDetails", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns release_date on hit", async () => {
    vi.mocked(deezerFetch).mockResolvedValue({ release_date: "2023-05-12" });
    const res = await fetchAlbumDetails({ deezerAlbumId: 12345 });
    expect(res).toEqual({ releaseDate: "2023-05-12" });
    expect(deezerFetch).toHaveBeenCalledWith("/album/12345");
  });

  it("returns null releaseDate when field missing", async () => {
    vi.mocked(deezerFetch).mockResolvedValue({});
    const res = await fetchAlbumDetails({ deezerAlbumId: 12345 });
    expect(res).toEqual({ releaseDate: null });
  });

  it("returns null when shape invalid", async () => {
    vi.mocked(deezerFetch).mockResolvedValue(null);
    const res = await fetchAlbumDetails({ deezerAlbumId: 12345 });
    expect(res).toBeNull();
  });
});
