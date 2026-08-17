# Landing Redesign - Split Hero with Floating Cluster - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty centered landing (`/`) with a compact, above-the-fold split hero - value prop + CTA on the left, an animated cluster of real product fragments (mini dashboard, album covers, KPI chip, vinyl) floating on the right - in loopstat's "Nébuleuse" design language.

**Architecture:** `page.tsx` stays a static server component (no DB query). Curated demo album covers are baked into `public/landing/`. A small client component (`FloatingCluster`) renders the floating elements; a CSS keyframe handles the idle bob, and a tiny vanilla `pointermove` handler adds subtle mouse parallax (disabled on touch / reduced-motion). Parallax composes with the float by putting the parallax transform on a wrapper and the float animation on an inner element.

**Tech Stack:** Next.js 16 App Router, React client component, Tailwind + inline styles (matching existing landing), CSS `@keyframes`, vitest for the one pure helper.

**Spec:** `docs/superpowers/specs/2026-06-21-landing-redesign-design.md`

---

## File Structure

**Create:**
- `public/landing/cover-espresso.jpg`, `cover-birds.jpg`, `cover-beautiful.jpg`, `cover-fortnight.jpg`, `cover-houdini.jpg`, `cover-texas.jpg` - 6 curated demo covers.
- `src/lib/landing/parallax.ts` - pure parallax-offset helper.
- `src/lib/landing/parallax.test.ts` - its test.
- `src/components/landing/landing-data.ts` - curated dashboard rows + floating cover list.
- `src/components/landing/floating-cluster.tsx` - client component (markup + float + parallax).

**Modify:**
- `src/app/globals.css` - add `ls-float` keyframes + class + reduced-motion guard.
- `src/app/page.tsx` - restructure into the split layout.
- `src/components/landing/landing-footer.tsx` - slim to one thin row (only if it isn't already; see Task 7).

**Note on TDD:** the only unit-testable logic here is the parallax math (Task 2, full TDD). The components are JSX/CSS - this repo has no component-render test harness (vitest covers queries/helpers only), so they are verified by `pnpm typecheck` + `pnpm lint` + `pnpm build` + visual check in `pnpm dev`. This is consistent with how the rest of the UI is built.

---

## Task 1: Curate the demo cover assets

**Files:**
- Create: `public/landing/cover-{espresso,birds,beautiful,fortnight,houdini,texas}.jpg`

- [ ] **Step 1: Create the folder and download the 6 covers**

Run:
```bash
cd /Users/poney53/Documents/Projets/loopstat
mkdir -p public/landing
curl -fsS "https://cdn-images.dzcdn.net/images/cover/0fd6e3b346b959a8781ccfa89b63607a/500x500-000000-80-0-0.jpg" -o public/landing/cover-espresso.jpg
curl -fsS "https://cdn-images.dzcdn.net/images/cover/5d284b31cb9ddeb1a0c79aede5a94e1c/500x500-000000-80-0-0.jpg" -o public/landing/cover-birds.jpg
curl -fsS "https://cdn-images.dzcdn.net/images/cover/71ca8c4c88fdb45381c4291bd4233ff6/500x500-000000-80-0-0.jpg" -o public/landing/cover-beautiful.jpg
curl -fsS "https://cdn-images.dzcdn.net/images/cover/73bee9f48378d4c95139e693fd997569/500x500-000000-80-0-0.jpg" -o public/landing/cover-fortnight.jpg
curl -fsS "https://cdn-images.dzcdn.net/images/cover/bcb2a6548c1dadd89d0e94e6fce6a754/500x500-000000-80-0-0.jpg" -o public/landing/cover-houdini.jpg
curl -fsS "https://cdn-images.dzcdn.net/images/cover/e4a77ce7d6781682afb716d21c0a6e3b/500x500-000000-80-0-0.jpg" -o public/landing/cover-texas.jpg
```

- [ ] **Step 2: Verify all 6 are valid JPEGs**

Run:
```bash
for f in espresso birds beautiful fortnight houdini texas; do file public/landing/cover-$f.jpg | grep -q "JPEG" && echo "$f ok" || echo "$f FAILED"; done
```
Expected: six `... ok` lines. If any FAILED, re-run that curl (the cover IDs are stable; a failure means a transient network issue).

- [ ] **Step 3: Commit**

```bash
git add public/landing/
git commit -m "feat(landing): add curated demo cover assets"
```

---

## Task 2: Parallax helper (TDD)

**Files:**
- Create: `src/lib/landing/parallax.ts`
- Test: `src/lib/landing/parallax.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/landing/parallax.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/landing/parallax.test.ts`
Expected: FAIL - cannot resolve `./parallax`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/landing/parallax.ts`:
```ts
export type Vec2 = { x: number; y: number };

/**
 * Parallax translation for a floating element. `nx`/`ny` are the cursor
 * position relative to the hero centre, normalised to ~[-1, 1] (left/top
 * negative, right/bottom positive). `factor` is the element's depth in px -
 * larger moves more. Returns the px offset to apply.
 */
export function parallaxTranslate(nx: number, ny: number, factor: number): Vec2 {
  return { x: nx * factor, y: ny * factor };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/landing/parallax.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/landing/parallax.ts src/lib/landing/parallax.test.ts
git commit -m "feat(landing): parallax offset helper (TDD)"
```

---

## Task 3: Float keyframes in globals.css

**Files:**
- Modify: `src/app/globals.css` (append at end of file)

- [ ] **Step 1: Append the keyframes + class + reduced-motion guard**

Add at the end of `src/app/globals.css`:
```css
@keyframes ls-float {
  0%, 100% { transform: translateY(0) rotate(var(--ls-tilt, 0deg)); }
  50% { transform: translateY(-10px) rotate(var(--ls-tilt, 0deg)); }
}
.ls-float {
  animation: ls-float var(--ls-dur, 7s) ease-in-out infinite;
  animation-delay: var(--ls-delay, 0s);
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .ls-float {
    animation: none;
    transform: rotate(var(--ls-tilt, 0deg));
  }
}
```

- [ ] **Step 2: Verify lint passes (no CSS build step to run standalone)**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(landing): ls-float keyframes + reduced-motion guard"
```

---

## Task 4: Curated landing data config

**Files:**
- Create: `src/components/landing/landing-data.ts`

- [ ] **Step 1: Write the config module**

`src/components/landing/landing-data.ts`:
```ts
export type LandingCover = { src: string; tilt: string; dur: string; delay: string };
export type LandingRow = { rank: number; src: string; title: string; artist: string };

// Mini-dashboard "Top titres" rows (demo top-3) - covers baked in public/landing/.
export const LANDING_ROWS: LandingRow[] = [
  { rank: 1, src: "/landing/cover-espresso.jpg", title: "Espresso", artist: "Sabrina Carpenter" },
  { rank: 2, src: "/landing/cover-birds.jpg", title: "BIRDS OF A FEATHER", artist: "Billie Eilish" },
  { rank: 3, src: "/landing/cover-beautiful.jpg", title: "Beautiful Things", artist: "Benson Boone" },
];

// Loose album covers that float around the dashboard card.
export const LANDING_FLOATING_COVERS: LandingCover[] = [
  { src: "/landing/cover-fortnight.jpg", tilt: "8deg", dur: "6.6s", delay: "0.5s" },
  { src: "/landing/cover-houdini.jpg", tilt: "-9deg", dur: "7.6s", delay: "1s" },
  { src: "/landing/cover-texas.jpg", tilt: "5deg", dur: "8.2s", delay: "0.2s" },
];
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/landing-data.ts
git commit -m "feat(landing): curated cluster data (rows + floating covers)"
```

---

## Task 5: FloatingCluster client component

**Files:**
- Create: `src/components/landing/floating-cluster.tsx`

- [ ] **Step 1: Write the component**

`src/components/landing/floating-cluster.tsx`:
```tsx
"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { parallaxTranslate } from "@/lib/landing/parallax";
import { LANDING_FLOATING_COVERS, LANDING_ROWS } from "./landing-data";

const GLASS = "rgba(244,240,255,0.06)";
const GLASS_BORDER = "1px solid rgba(244,240,255,0.13)";

export function FloatingCluster() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-factor]"));
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const el of items) {
          const { x, y } = parallaxTranslate(nx, ny, Number(el.dataset.factor));
          el.style.transform = `translate(${x}px, ${y}px)`;
        }
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative h-full w-full" aria-hidden="true">
      {/* Mini dashboard - parallax wrapper + inner float */}
      <div
        data-factor="10"
        className="absolute"
        style={{ right: "6%", top: "8%", width: 224 }}
      >
        <div
          className="ls-float"
          style={
            {
              "--ls-tilt": "-6deg",
              "--ls-dur": "8s",
              padding: "13px 15px",
              borderRadius: 14,
              background: "rgba(20,12,36,0.86)",
              border: GLASS_BORDER,
            } as CSSProperties
          }
        >
          <div
            style={{
              font: "11px system-ui",
              letterSpacing: 1,
              color: "#8a7fb0",
              textTransform: "uppercase",
            }}
          >
            Top titres
          </div>
          {LANDING_ROWS.map((row) => (
            <div
              key={row.rank}
              style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}
            >
              <span
                style={{
                  font: "italic 16px var(--font-instrument-serif), serif",
                  color: "#7c6fa0",
                  width: 12,
                }}
              >
                {row.rank}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.src}
                alt=""
                width={30}
                height={30}
                style={{ borderRadius: 6, objectFit: "cover" }}
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    font: "500 12px system-ui",
                    color: "#f4f0ff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.title}
                </span>
                <span
                  style={{
                    display: "block",
                    font: "11px system-ui",
                    color: "#a89ec8",
                    marginTop: 2,
                  }}
                >
                  {row.artist}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI chip */}
      <div data-factor="22" className="absolute" style={{ left: "4%", top: "62%" }}>
        <div
          className="ls-float"
          style={
            {
              "--ls-dur": "9s",
              "--ls-delay": "0.3s",
              padding: "8px 12px",
              borderRadius: 13,
              background: GLASS,
              border: GLASS_BORDER,
            } as CSSProperties
          }
        >
          <div style={{ font: "italic 22px var(--font-instrument-serif), serif", lineHeight: 1, color: "#fff" }}>
            4&nbsp;499&nbsp;h
          </div>
          <div style={{ font: "10px system-ui", color: "#a89ec8", marginTop: 2 }}>au total</div>
        </div>
      </div>

      {/* Vinyl satellite (favicon motif) */}
      <div data-factor="28" className="absolute hidden md:block" style={{ left: "10%", top: "12%" }}>
        <div
          className="ls-float"
          style={{ "--ls-dur": "7.2s", "--ls-delay": "0.8s" } as CSSProperties}
        >
          <span
            style={{
              display: "flex",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: "#0a0712",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa" }} />
            </span>
          </span>
        </div>
      </div>

      {/* Floating album covers (extras hidden on mobile to stay above the fold) */}
      {LANDING_FLOATING_COVERS.map((c, i) => (
        <div
          key={c.src}
          data-factor={String(16 + i * 6)}
          className={i === 0 ? "absolute" : "absolute hidden md:block"}
          style={
            [
              { left: "62%", top: "70%" },
              { left: "40%", top: "26%" },
              { left: "78%", top: "40%" },
            ][i]
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.src}
            alt=""
            width={48}
            height={48}
            className="ls-float"
            style={
              {
                "--ls-tilt": c.tilt,
                "--ls-dur": c.dur,
                "--ls-delay": c.delay,
                borderRadius: 9,
                objectFit: "cover",
                display: "block",
              } as CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pass (the `eslint-disable-next-line @next/next/no-img-element` comments suppress the img-element warning, consistent with the share-card templates).

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/floating-cluster.tsx
git commit -m "feat(landing): FloatingCluster (float + subtle mouse parallax)"
```

---

## Task 6: Restructure page.tsx into the split layout

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the page**

`src/app/page.tsx`:
```tsx
import Link from "next/link";

import { FloatingCluster } from "@/components/landing/floating-cluster";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";

export default function HomePage() {
  return (
    <main
      id="main"
      className="flex min-h-[100svh] flex-col"
      style={{
        background: "radial-gradient(ellipse at 80% 0%, #1a0d2e 0%, #070710 62%)",
        color: "#f4f0ff",
      }}
    >
      <LandingHeader />

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:px-12">
        <div className="flex flex-col items-center gap-5 text-center md:items-start md:text-left">
          <h1
            className="text-[40px] font-medium leading-[1.04] sm:text-[56px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Ton Spotify,
            <br />
            <span
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                color: "#c4b5fd",
              }}
            >
              en chiffres.
            </span>
          </h1>

          <p className="max-w-md text-base sm:text-lg" style={{ color: "#a89ec8", lineHeight: 1.5 }}>
            Tops, historique d&apos;écoute, listening clock - toutes tes stats,
            gratuit et sans pub.
          </p>

          <div className="mt-1 flex flex-col items-center gap-3 md:items-start">
            <GoogleSignInButton />
            <Link
              href="/u/demo"
              className="inline-flex items-center gap-1.5 text-[15px] font-medium transition hover:underline"
              style={{ color: "#c4b5fd" }}
            >
              Voir un exemple <span style={{ opacity: 0.6 }}>→</span>
            </Link>
          </div>

          <p className="text-[13px]" style={{ color: "#5a5070" }}>
            Gratuit · 30 secondes · sans pub
          </p>
        </div>

        <div className="relative h-[280px] w-full md:h-[440px]">
          <FloatingCluster />
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass. (`pnpm build` confirms the public route renders without runtime env - important since the landing is public.)

- [ ] **Step 3: Visual check in dev**

Run (if dev server not already up): `pnpm dev`
Open `http://127.0.0.1:3000/`. Confirm:
- Split layout: text left, floating cluster right.
- Elements bob gently; moving the mouse shifts them subtly (parallax).
- Everything fits with no scroll on a normal desktop window.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): split hero layout with floating cluster"
```

---

## Task 7: Footer - confirm it stays above the fold (likely no change)

**Files:**
- Possibly modify: `src/components/landing/landing-footer.tsx`

The current footer is already a single compact row: `border-t px-8 py-5 text-xs`,
with `© 2026 loopstat` on the left and a nav of three links on the right -
`CGU` (`/terms`), `Confidentialité` (`/privacy`), `Mentions légales` (`/legal`).
It almost certainly fits without change.

- [ ] **Step 1: Visual confirm in dev**

At `http://127.0.0.1:3000/`, confirm the footer sits at the bottom and the page
does not scroll. If it fits (expected), **no change - skip to Task 8.**

- [ ] **Step 2 (only if the page scrolls because of footer height): reduce padding**

Edit `src/components/landing/landing-footer.tsx`: change the footer `className`
padding from `py-5` to `py-3` (keep everything else, including the existing
hrefs `/terms`, `/privacy`, `/legal`). Then:
```bash
pnpm typecheck && pnpm lint
git add src/components/landing/landing-footer.tsx
git commit -m "refactor(landing): tighten footer padding for above-the-fold"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full green check**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: typecheck pass, lint clean, all tests pass (including the new parallax test), build succeeds.

- [ ] **Step 2: Visual + motion + responsive check**

In `pnpm dev` at `http://127.0.0.1:3000/`:
- Desktop window: split layout, no scroll, gentle float + subtle parallax on mouse move.
- Narrow the window (mobile width): single column - text on top, simplified cluster below (vinyl + 2 extra covers hidden), still no scroll.
- Toggle reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion) and reload: floating elements are static (no bob, no parallax).

- [ ] **Step 3: Confirm no regressions on the rest of the app**

Spot-check `http://127.0.0.1:3000/login` and `/pricing` still render (the landing change is isolated, but confirm the shared header/footer components still work).

---

## Notes for the executor

- Match the existing landing's styling idiom (inline `style={{…}}` + Tailwind utility classes); the codebase uses this throughout `src/components/landing/`.
- Album covers render via plain `<img>` (not `next/image`) with an `eslint-disable-next-line @next/next/no-img-element` comment - the same pattern as `src/app/api/share-card/templates/` and the artist page. This is intentional (small decorative covers, no optimizer needed).
- Exact `left`/`top` percentages and `data-factor` values in `FloatingCluster` are starting points tuned to the approved `landing_dir_b_split` mockup. Adjust by eye in `pnpm dev` so nothing overlaps the dashboard card or the text column.
- Deployment: this ships with the next prod redeploy (rsync + rebuild) - no migration, no env change. Not part of this plan unless requested.
