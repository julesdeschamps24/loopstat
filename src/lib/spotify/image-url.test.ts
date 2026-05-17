import { describe, expect, it } from "vitest";

import { shrinkAlbumCoverUrl } from "./image-url";

describe("shrinkAlbumCoverUrl", () => {
  it("shrinks a 640 album cover to medium (300)", () => {
    const big =
      "https://i.scdn.co/image/ab67616d0000b273f8c3df40fb06eb459e1d0a08";
    expect(shrinkAlbumCoverUrl(big, "medium")).toBe(
      "https://i.scdn.co/image/ab67616d00001e02f8c3df40fb06eb459e1d0a08",
    );
  });

  it("shrinks a 640 album cover to small (64)", () => {
    const big =
      "https://i.scdn.co/image/ab67616d0000b273f8c3df40fb06eb459e1d0a08";
    expect(shrinkAlbumCoverUrl(big, "small")).toBe(
      "https://i.scdn.co/image/ab67616d00004851f8c3df40fb06eb459e1d0a08",
    );
  });

  it("returns the URL unchanged when the size code doesn't match", () => {
    // e.g. user profile image (different prefix)
    const userImg =
      "https://i.scdn.co/image/ab6775700000ee85460e012c89a20878d6ae29f2";
    expect(shrinkAlbumCoverUrl(userImg, "medium")).toBe(userImg);
  });

  it("returns the URL unchanged when it's not a Spotify CDN URL", () => {
    const other = "https://example.com/whatever.png";
    expect(shrinkAlbumCoverUrl(other, "medium")).toBe(other);
  });

  it("handles null / undefined / empty by returning null", () => {
    expect(shrinkAlbumCoverUrl(null, "medium")).toBeNull();
    expect(shrinkAlbumCoverUrl(undefined, "medium")).toBeNull();
    expect(shrinkAlbumCoverUrl("", "medium")).toBeNull();
  });
});
