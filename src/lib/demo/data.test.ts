import { describe, expect, it } from "vitest";
import {
  DEMO_TOP_TRACKS,
  DEMO_TOP_ARTISTS,
  DEMO_TOP_ALBUMS,
  DEMO_LISTENING_HOURS,
  DEMO_TOTAL_PLAYS,
  DEMO_TOTAL_HOURS_LISTENED,
  isDemoId,
  getDemoTrack,
  getDemoArtist,
  getDemoAlbum,
} from "./data";

describe("demo fixtures", () => {
  it("DEMO_TOP_TRACKS has 30 entries sorted by plays descending", () => {
    expect(DEMO_TOP_TRACKS).toHaveLength(30);
    for (let i = 1; i < DEMO_TOP_TRACKS.length; i++) {
      expect(DEMO_TOP_TRACKS[i].plays).toBeLessThanOrEqual(
        DEMO_TOP_TRACKS[i - 1].plays,
      );
    }
  });

  it("DEMO_TOP_TRACKS entries have demo: prefixed IDs and required fields", () => {
    for (const track of DEMO_TOP_TRACKS) {
      expect(track.trackId).toMatch(/^demo:/);
      expect(typeof track.name).toBe("string");
      expect(track.name.length).toBeGreaterThan(0);
      expect(Array.isArray(track.artistNames)).toBe(true);
      expect(track.artistNames.length).toBeGreaterThan(0);
      expect(typeof track.plays).toBe("number");
      expect(track.plays).toBeGreaterThan(0);
    }
  });

  it("DEMO_TOP_ARTISTS has 15 entries with descending plays", () => {
    expect(DEMO_TOP_ARTISTS).toHaveLength(15);
    for (let i = 1; i < DEMO_TOP_ARTISTS.length; i++) {
      expect(DEMO_TOP_ARTISTS[i].plays).toBeLessThanOrEqual(
        DEMO_TOP_ARTISTS[i - 1].plays,
      );
    }
  });

  it("DEMO_TOP_ALBUMS has 15 entries with descending plays", () => {
    expect(DEMO_TOP_ALBUMS).toHaveLength(15);
    for (let i = 1; i < DEMO_TOP_ALBUMS.length; i++) {
      expect(DEMO_TOP_ALBUMS[i].plays).toBeLessThanOrEqual(
        DEMO_TOP_ALBUMS[i - 1].plays,
      );
    }
  });

  it("DEMO_LISTENING_HOURS has 24 entries indexed by hour 0..23", () => {
    expect(DEMO_LISTENING_HOURS).toHaveLength(24);
    for (let h = 0; h < 24; h++) {
      expect(DEMO_LISTENING_HOURS[h].hour).toBe(h);
      expect(typeof DEMO_LISTENING_HOURS[h].count).toBe("number");
      expect(DEMO_LISTENING_HOURS[h].count).toBeGreaterThanOrEqual(0);
    }
  });

  it("totals are realistic positive numbers", () => {
    expect(DEMO_TOTAL_PLAYS).toBeGreaterThan(1000);
    expect(DEMO_TOTAL_HOURS_LISTENED).toBeGreaterThan(100);
  });
});

describe("demo detail helpers", () => {
  describe("isDemoId", () => {
    it("returns true for demo: prefixed IDs", () => {
      expect(isDemoId("demo:espresso")).toBe(true);
      expect(isDemoId("demo:anything")).toBe(true);
    });

    it("returns false for non-demo IDs", () => {
      expect(isDemoId("4EWzghMNZsqi3xqdutlL1O")).toBe(false);
      expect(isDemoId("")).toBe(false);
      expect(isDemoId("demoNoColon")).toBe(false);
    });
  });

  describe("getDemoTrack", () => {
    it("returns null for non-demo IDs", () => {
      expect(getDemoTrack("4EWzghMNZsqi3xqdutlL1O")).toBeNull();
    });

    it("returns null for unknown demo track", () => {
      expect(getDemoTrack("demo:unknown-track")).toBeNull();
    });

    it("returns full detail for a known demo track", () => {
      const detail = getDemoTrack("demo:espresso");
      expect(detail).not.toBeNull();
      if (!detail) return;
      expect(detail.track.name).toBe("Espresso");
      expect(detail.stats.count).toBe(1247);
      expect(detail.stats.firstPlayedAt).toBeInstanceOf(Date);
      expect(detail.stats.lastPlayedAt).toBeInstanceOf(Date);
      expect(detail.stats.firstPlayedAt.getTime()).toBeLessThan(
        detail.stats.lastPlayedAt.getTime(),
      );
      expect(detail.breakdown.all).toBe(1247);
      expect(detail.breakdown["4w"]).toBeLessThanOrEqual(detail.breakdown["6m"]);
      expect(detail.breakdown["6m"]).toBeLessThanOrEqual(detail.breakdown["1y"]);
      expect(detail.monthly).toHaveLength(18);
      expect(detail.hours).toHaveLength(24);
      expect(detail.quality.avgMs).toBeGreaterThan(0);
      expect(detail.quality.skipRate).toBeGreaterThanOrEqual(0);
      expect(detail.quality.skipRate).toBeLessThan(1);
    });

    it("is deterministic across calls", () => {
      const a = getDemoTrack("demo:espresso");
      const b = getDemoTrack("demo:espresso");
      expect(a?.stats.firstPlayedAt.getTime()).toBe(
        b?.stats.firstPlayedAt.getTime(),
      );
      expect(a?.quality.avgMs).toBe(b?.quality.avgMs);
    });
  });

  describe("getDemoArtist", () => {
    it("returns null for non-demo IDs", () => {
      expect(getDemoArtist("4EWzghMNZsqi3xqdutlL1O")).toBeNull();
    });

    it("returns null for unknown demo artist", () => {
      expect(getDemoArtist("demo:unknown-artist")).toBeNull();
    });

    it("returns artist + top tracks for a known demo artist", () => {
      const detail = getDemoArtist("demo:sabrina-carpenter");
      expect(detail).not.toBeNull();
      if (!detail) return;
      expect(detail.artist.name).toBe("Sabrina Carpenter");
      expect(detail.stats.count).toBeGreaterThan(0);
      expect(detail.topTracks.length).toBeGreaterThan(0);
      for (const t of detail.topTracks) {
        expect(t.trackId).toMatch(/^demo:/);
      }
    });
  });

  describe("getDemoAlbum", () => {
    it("returns null for non-demo IDs", () => {
      expect(getDemoAlbum("4EWzghMNZsqi3xqdutlL1O")).toBeNull();
    });

    it("returns null for unknown demo album", () => {
      expect(getDemoAlbum("demo:unknown-album")).toBeNull();
    });

    it("returns album + tracks + sparkline for a known demo album", () => {
      const detail = getDemoAlbum("demo:short-n-sweet");
      expect(detail).not.toBeNull();
      if (!detail) return;
      expect(detail.album.name).toBe("Short n' Sweet");
      expect(detail.tracks.length).toBeGreaterThanOrEqual(5);
      expect(detail.tracks[0].trackNumber).toBe(1);
      expect(detail.monthly).toHaveLength(18);
      expect(detail.hours).toHaveLength(24);
      expect(detail.breakdown.all).toBe(detail.album.plays);
      expect(detail.otherAlbums).toBeDefined();
    });
  });
});
