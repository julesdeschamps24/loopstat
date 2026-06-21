import { describe, expect, it } from "vitest";

import { parallaxTranslate } from "./parallax";

describe("parallaxTranslate", () => {
  it("returns no offset when the cursor is at the centre", () => {
    expect(parallaxTranslate(0, 0, 20)).toEqual({ x: 0, y: 0 });
  });

  it("scales each axis by the element's depth factor", () => {
    expect(parallaxTranslate(1, -0.5, 20)).toEqual({ x: 20, y: -10 });
  });

  it("moves a near element (larger factor) more than a far one", () => {
    const near = parallaxTranslate(1, 1, 30);
    const far = parallaxTranslate(1, 1, 10);
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
  });
});
