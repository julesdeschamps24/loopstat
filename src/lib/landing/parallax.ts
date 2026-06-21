export type Vec2 = { x: number; y: number };

/**
 * Parallax translation for a floating element. `nx`/`ny` are the cursor
 * position relative to the hero centre, normalised to ~[-1, 1] (left/top
 * negative, right/bottom positive). `factor` is the element's depth in px —
 * larger moves more. Returns the px offset to apply.
 */
export function parallaxTranslate(nx: number, ny: number, factor: number): Vec2 {
  return { x: nx * factor, y: ny * factor };
}
