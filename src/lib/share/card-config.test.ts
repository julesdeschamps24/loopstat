import { describe, expect, it } from "vitest";

import {
  CONTEXT_PRESETS,
  FORMAT_N_OPTIONS,
  RECAP_N_BY_FORMAT,
  SHARE_CARD_DEFAULTS,
  buildShareCardUrl,
  clampNForFormat,
  parseShareCardParams,
  validForFormat,
} from "./card-config";

describe("parseShareCardParams", () => {
  it("returns defaults on empty input", () => {
    expect(parseShareCardParams({})).toEqual(SHARE_CARD_DEFAULTS);
  });

  it("accepts a complete URLSearchParams", () => {
    const sp = new URLSearchParams(
      "mode=focus&type=artists&n=7&period=6m&format=post&bg=wall",
    );
    expect(parseShareCardParams(sp)).toEqual({
      mode: "focus",
      type: "artists",
      n: 7,
      period: "6m",
      format: "post",
      bg: "wall",
    });
  });

  it("falls back to defaults on garbage inputs (never throws)", () => {
    expect(
      parseShareCardParams({
        mode: "lolwat",
        type: "songs",
        n: "abc",
        period: "1y",
        format: "story",
        bg: "mesh",
      }),
    ).toEqual({
      ...SHARE_CARD_DEFAULTS,
      period: "1y",
      format: "story",
      bg: "mesh",
    });
  });

  it("clamps n to a valid value for the chosen format", () => {
    const out = parseShareCardParams({ format: "twitter", n: "10" });
    expect(out.format).toBe("twitter");
    expect(out.n).toBe(5);
  });

  it("falls back to default n when n is zero or negative", () => {
    expect(parseShareCardParams({ n: "0" }).n).toBe(SHARE_CARD_DEFAULTS.n);
    expect(parseShareCardParams({ n: "-3" }).n).toBe(SHARE_CARD_DEFAULTS.n);
  });
});

describe("validForFormat", () => {
  it("matches the matrix from the spec", () => {
    expect(validForFormat("twitter", 3)).toBe(true);
    expect(validForFormat("twitter", 5)).toBe(true);
    expect(validForFormat("twitter", 7)).toBe(false);
    expect(validForFormat("twitter", 10)).toBe(false);

    expect(validForFormat("post", 3)).toBe(true);
    expect(validForFormat("post", 7)).toBe(true);
    expect(validForFormat("post", 10)).toBe(false);

    expect(validForFormat("story", 10)).toBe(true);
    expect(validForFormat("story", 11)).toBe(false);
  });
});

describe("clampNForFormat", () => {
  it("returns n if already valid", () => {
    expect(clampNForFormat("post", 5)).toBe(5);
  });

  it("returns the max valid value when n is too big", () => {
    expect(clampNForFormat("twitter", 10)).toBe(5);
    expect(clampNForFormat("post", 12)).toBe(7);
  });

  it("returns the min valid value when n is too small", () => {
    expect(clampNForFormat("story", 1)).toBe(3);
  });
});

describe("FORMAT_N_OPTIONS", () => {
  it("matches the matrix exactly", () => {
    expect(FORMAT_N_OPTIONS).toEqual({
      twitter: [3, 5],
      post: [3, 5, 7],
      story: [3, 5, 7, 10],
    });
  });
});

describe("RECAP_N_BY_FORMAT", () => {
  it("is 3 for twitter/post, 5 for story", () => {
    expect(RECAP_N_BY_FORMAT).toEqual({
      twitter: 3,
      post: 3,
      story: 5,
    });
  });
});

describe("CONTEXT_PRESETS", () => {
  it("dashboard preset is recap+story", () => {
    expect(CONTEXT_PRESETS.dashboard).toEqual({
      mode: "recap",
      format: "story",
    });
  });

  it("/top/* presets target the matching category in story format", () => {
    expect(CONTEXT_PRESETS.tracks).toEqual({
      mode: "focus",
      type: "tracks",
      format: "story",
    });
    expect(CONTEXT_PRESETS.artists).toMatchObject({ type: "artists" });
    expect(CONTEXT_PRESETS.albums).toMatchObject({ type: "albums" });
  });
});

describe("buildShareCardUrl", () => {
  it("includes username + all config fields", () => {
    const url = buildShareCardUrl(SHARE_CARD_DEFAULTS, "judescha");
    expect(url).toMatch(/^\/api\/share-card\?/);
    expect(url).toContain("username=judescha");
    expect(url).toContain("mode=focus");
    expect(url).toContain("type=tracks");
    expect(url).toContain("n=5");
    expect(url).toContain("period=4w");
    expect(url).toContain("format=story");
    expect(url).toContain("bg=mesh");
  });
});
