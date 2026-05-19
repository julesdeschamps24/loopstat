import { describe, expect, it } from "vitest";
import {
  DEMO_TOP_TRACKS,
  DEMO_TOP_ARTISTS,
  DEMO_TOP_ALBUMS,
  DEMO_LISTENING_HOURS,
  DEMO_TOTAL_PLAYS,
  DEMO_TOTAL_HOURS_LISTENED,
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
